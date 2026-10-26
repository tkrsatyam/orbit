package com.orbit.message;

import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.ForbiddenException;
import com.orbit.common.exception.RateLimitException;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.common.filter.RateLimitFilter;
import com.orbit.common.ratelimit.ConsumptionResult;
import com.orbit.common.ratelimit.TokenBucketRateLimiter;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import com.orbit.contact.ContactService;
import com.orbit.conversation.ConversationRepository;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import com.orbit.conversation.model.LastMessageSnapshot;
import com.orbit.group.GroupRepository;
import com.orbit.group.model.GroupRole;
import com.orbit.message.dto.EditMessageRequest;
import com.orbit.message.dto.MessageHistoryResponse;
import com.orbit.message.dto.MessageResponse;
import com.orbit.message.dto.SendMessageRequest;
import com.orbit.message.kafka.KafkaMessageProducer;
import com.orbit.message.kafka.MessageDeletedEvent;
import com.orbit.message.kafka.MessageDeliveryEvent;
import com.orbit.message.kafka.MessageEditedEvent;
import com.orbit.message.kafka.MessageReadEvent;
import com.orbit.message.model.BlockedMessage;
import com.orbit.message.model.Message;
import com.orbit.message.model.MessageDeleteMode;
import com.orbit.message.model.MessageDeliveryStatus;
import com.orbit.message.model.MessageType;
import com.orbit.message.model.ReadReceipt;
import com.orbit.notification.NotificationRepository;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Owns the core message send path and lifecycle.
 * Strictly enforces ordering from docs/architecture/sequences/message_send_flow.md
 * and blocked-sender diversion from ADR 007.
 */
@Service
public class MessageService {

    private static final Logger log = LoggerFactory.getLogger(MessageService.class);

    private final MessageRepository messageRepository;
    private final BlockedMessageRepository blockedMessageRepository;
    private final ConversationRepository conversationRepository;
    private final NotificationRepository notificationRepository;
    private final ContactService contactService;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final KafkaMessageProducer kafkaMessageProducer;
    private final TokenBucketRateLimiter rateLimiter;
    private final OrbitProperties properties;

    public MessageService(MessageRepository messageRepository,
                          BlockedMessageRepository blockedMessageRepository,
                          ConversationRepository conversationRepository,
                          NotificationRepository notificationRepository,
                          ContactService contactService,
                          UserRepository userRepository,
                          GroupRepository groupRepository,
                          KafkaMessageProducer kafkaMessageProducer,
                          TokenBucketRateLimiter rateLimiter,
                          OrbitProperties properties) {
        this.messageRepository = messageRepository;
        this.blockedMessageRepository = blockedMessageRepository;
        this.conversationRepository = conversationRepository;
        this.notificationRepository = notificationRepository;
        this.contactService = contactService;
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.kafkaMessageProducer = kafkaMessageProducer;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
    }

    /**
     * Sends a message within a conversation.
     * Enforces the non-negotiable sequence:
     * Rate-limit check -> Participant check -> Idempotency check -> Block check ->
     * Persist to MongoDB -> Update lastMessage snapshot -> Upsert notifications ->
     * Publish to Kafka -> Return receipt to sender.
     *
     * @param conversationId the conversation destination
     * @param senderId       the authenticated sender user ID
     * @param request        the message payload
     * @return the saved message response
     */
    public MessageResponse sendMessage(String conversationId, String senderId, SendMessageRequest request) {
        if (conversationId == null || conversationId.isBlank()) {
            throw new IllegalArgumentException("Conversation ID cannot be blank");
        }
        if (senderId == null || senderId.isBlank()) {
            throw new IllegalArgumentException("Sender ID cannot be blank");
        }
        if (request == null || request.content() == null || request.content().isBlank()) {
            throw new IllegalArgumentException("Message content cannot be blank");
        }

        // 1. Rate-limit check (60 messages per minute per user)
        // Avoid duplicate consumption if RateLimitFilter already consumed from the bucket for this REST request
        boolean alreadyConsumed = false;
        try {
            RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
            if (attrs instanceof ServletRequestAttributes servletAttrs) {
                alreadyConsumed = Boolean.TRUE.equals(
                        servletAttrs.getRequest().getAttribute(RateLimitFilter.RATE_LIMIT_CONSUMED_ATTR));
            }
        } catch (Exception ignored) {
        }

        if (!alreadyConsumed) {
            int messageLimit = properties.rateLimit().messagesPerMinute();
            ConsumptionResult rateLimitResult = rateLimiter.tryConsume("MESSAGES:user:" + senderId, messageLimit);
            if (!rateLimitResult.allowed()) {
                throw new RateLimitException("Message rate limit exceeded", rateLimitResult.retryAfterSeconds());
            }
        }

        // 2. Validate conversation existence and participant membership
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        if (conversation.getParticipantIds() == null || !conversation.getParticipantIds().contains(senderId)) {
            throw new ForbiddenException("User is not a participant in this conversation");
        }

        // 3. Idempotency deduplication check
        String idempotencyKey = request.idempotencyKey();
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<Message> existingNormal = messageRepository.findByConversationIdAndIdempotencyKey(conversationId, idempotencyKey);
            if (existingNormal.isPresent()) {
                log.debug("Returning existing message for idempotencyKey={}", idempotencyKey);
                return MessageResponse.from(existingNormal.get());
            }

            Optional<BlockedMessage> existingBlocked = blockedMessageRepository.findByConversationIdAndSenderIdAndIdempotencyKey(conversationId, senderId, idempotencyKey);
            if (existingBlocked.isPresent()) {
                log.debug("Returning existing blocked message for idempotencyKey={}", idempotencyKey);
                return MessageResponse.from(existingBlocked.get());
            }
        }

        // Resolve sender display name snapshot
        String senderName = userRepository.findById(senderId)
                .map(User::getDisplayName)
                .orElse("Orbit User");

        List<String> recipientIds = conversation.getParticipantIds().stream()
                .filter(id -> !id.equals(senderId))
                .toList();

        MessageType messageType = request.type() != null ? request.type() : MessageType.TEXT;

        // 4. Block status check (1:1 conversations only, per ADR 007)
        boolean isBlocked = false;
        if (conversation.getType() == ConversationType.DIRECT && !recipientIds.isEmpty()) {
            String recipientId = recipientIds.get(0);
            isBlocked = contactService.isBlockedBy(senderId, recipientId);
        }

        // 5a. Blocked-Sender Diversion Path (ADR 007)
        if (isBlocked) {
            log.info("Sender {} is blocked by recipient; diverting message to blockedMessages collection", senderId);
            BlockedMessage blockedMessage = BlockedMessage.builder()
                    .conversationId(conversationId)
                    .senderId(senderId)
                    .senderName(senderName)
                    .type(messageType)
                    .content(request.content())
                    .idempotencyKey(idempotencyKey)
                    .createdAt(Instant.now())
                    .build();

            BlockedMessage savedBlocked = blockedMessageRepository.save(blockedMessage);
            // Steps 3 (lastMessage), 4 (notifications), and 5 (Kafka) are skipped entirely per ADR 007
            return MessageResponse.from(savedBlocked, MessageDeliveryStatus.SENT);
        }

        // 5b. Normal Send Path (Persist-before-publish)
        Message message = Message.builder()
                .conversationId(conversationId)
                .senderId(senderId)
                .senderName(senderName)
                .type(messageType)
                .content(request.content())
                .idempotencyKey(idempotencyKey)
                .createdAt(Instant.now())
                .build();

        Message savedMessage = messageRepository.save(message);

        // 6. Update lastMessage snapshot on conversation
        LastMessageSnapshot snapshot = LastMessageSnapshot.builder()
                .messageId(savedMessage.getId())
                .content(savedMessage.getContent())
                .senderId(savedMessage.getSenderId())
                .senderName(savedMessage.getSenderName())
                .sentAt(savedMessage.getCreatedAt())
                .build();
        conversation.setLastMessage(snapshot);
        conversationRepository.save(conversation);

        // 7. Upsert unread notification counts for all recipients (bulk write when multiple)
        if (recipientIds.size() == 1) {
            notificationRepository.incrementUnreadCount(recipientIds.get(0), conversationId);
        } else if (recipientIds.size() > 1) {
            notificationRepository.incrementUnreadCounts(recipientIds, conversationId);
        }

        // 8. Publish MessageDeliveryEvent to Kafka chat.messages
        MessageResponse deliveryResponse = MessageResponse.from(savedMessage, MessageDeliveryStatus.DELIVERED);
        MessageDeliveryEvent event = new MessageDeliveryEvent(
                savedMessage.getId(),
                conversationId,
                senderId,
                recipientIds,
                deliveryResponse
        );
        kafkaMessageProducer.publishMessage(event);

        // 9. Return receipt to sender (status SENT)
        return MessageResponse.from(savedMessage, MessageDeliveryStatus.SENT);
    }

    /**
     * Retrieves paginated message history for a conversation.
     * Enforces participant membership and cursor-based pagination.
     * Merges normal messages and blocked messages scoped to the requesting sender (ADR 007).
     *
     * @param conversationId the conversation identifier
     * @param currentUserId  the authenticated user ID requesting history
     * @param size           page size (default 50, maximum 100)
     * @param before         optional message ID cursor to paginate backwards from
     * @return paginated message history in chronological order
     */
    public MessageHistoryResponse getConversationMessages(String conversationId, String currentUserId, Integer size, String before) {
        if (conversationId == null || conversationId.isBlank()) {
            throw new IllegalArgumentException("Conversation ID cannot be blank");
        }
        if (currentUserId == null || currentUserId.isBlank()) {
            throw new IllegalArgumentException("User ID cannot be blank");
        }

        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        if (conversation.getParticipantIds() == null || !conversation.getParticipantIds().contains(currentUserId)) {
            throw new ForbiddenException("User is not a participant in this conversation");
        }

        int pageSize = (size == null || size <= 0) ? 50 : Math.min(size, 100);

        Instant cursorCreatedAt = null;
        if (before != null && !before.isBlank()) {
            Optional<Message> normalMsg = messageRepository.findById(before);
            if (normalMsg.isPresent() && conversationId.equals(normalMsg.get().getConversationId())) {
                cursorCreatedAt = normalMsg.get().getCreatedAt();
            } else {
                Optional<BlockedMessage> blockedMsg = blockedMessageRepository.findById(before);
                if (blockedMsg.isPresent()
                        && conversationId.equals(blockedMsg.get().getConversationId())
                        && currentUserId.equals(blockedMsg.get().getSenderId())) {
                    cursorCreatedAt = blockedMsg.get().getCreatedAt();
                } else {
                    throw new ResourceNotFoundException("Cursor message not found: " + before);
                }
            }
        }

        PageRequest pageRequest = PageRequest.of(0, pageSize + 1);
        List<Message> messages;
        List<BlockedMessage> blockedMessages;

        if (cursorCreatedAt != null) {
            messages = messageRepository.findByConversationIdAndNotDeletedForAndCreatedAtLessThanOrderByCreatedAtDesc(
                    conversationId, currentUserId, cursorCreatedAt, pageRequest);
            blockedMessages = blockedMessageRepository.findByConversationIdAndSenderIdAndNotDeletedForAndCreatedAtLessThanOrderByCreatedAtDesc(
                    conversationId, currentUserId, cursorCreatedAt, pageRequest);
        } else {
            messages = messageRepository.findByConversationIdAndNotDeletedForOrderByCreatedAtDesc(
                    conversationId, currentUserId, pageRequest);
            blockedMessages = blockedMessageRepository.findByConversationIdAndSenderIdAndNotDeletedForOrderByCreatedAtDesc(
                    conversationId, currentUserId, pageRequest);
        }

        List<MessageResponse> combined = new ArrayList<>(messages.size() + blockedMessages.size());
        for (Message m : messages) {
            combined.add(MessageResponse.from(m, MessageDeliveryStatus.DELIVERED));
        }
        for (BlockedMessage bm : blockedMessages) {
            combined.add(MessageResponse.from(bm, MessageDeliveryStatus.SENT));
        }

        // Sort descending by createdAt (newest first)
        combined.sort(Comparator.comparing(MessageResponse::createdAt, Comparator.reverseOrder())
                .thenComparing(MessageResponse::id, Comparator.reverseOrder()));

        boolean hasMore = combined.size() > pageSize;
        List<MessageResponse> sliced = hasMore ? combined.subList(0, pageSize) : combined;

        String nextCursor = (hasMore && !sliced.isEmpty()) ? sliced.get(sliced.size() - 1).id() : null;

        List<MessageResponse> content = new ArrayList<>(sliced);
        Collections.reverse(content);

        return new MessageHistoryResponse(content, hasMore, nextCursor);
    }

    /**
     * Edits a text message authored by the authenticated user.
     * Enforces P1-15: only sender can edit, only TEXT messages, no edit history stored.
     * Fans out MessageEditedEvent to Kafka topic 'chat.messages.edited'.
     *
     * @param conversationId the conversation identifier
     * @param messageId      the ID of the message to edit
     * @param currentUserId  the authenticated user requesting the edit
     * @param request        the updated message content
     * @return updated MessageResponse with edited: true and editedAt populated
     */
    public MessageResponse editMessage(String conversationId, String messageId, String currentUserId, EditMessageRequest request) {
        if (conversationId == null || conversationId.isBlank()) {
            throw new IllegalArgumentException("Conversation ID cannot be blank");
        }
        if (messageId == null || messageId.isBlank()) {
            throw new IllegalArgumentException("Message ID cannot be blank");
        }
        if (request == null || request.content() == null || request.content().trim().isBlank()) {
            throw new IllegalArgumentException("Message content cannot be blank");
        }

        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        if (conversation.getParticipantIds() == null || !conversation.getParticipantIds().contains(currentUserId)) {
            throw new ForbiddenException("User is not a participant in this conversation");
        }

        Optional<Message> normalMsgOpt = messageRepository.findById(messageId);
        if (normalMsgOpt.isPresent()) {
            Message message = normalMsgOpt.get();
            if (!conversationId.equals(message.getConversationId())) {
                throw new ResourceNotFoundException("Message not found in conversation");
            }
            if (!currentUserId.equals(message.getSenderId())) {
                throw new ForbiddenException("You can only edit your own messages");
            }
            if (message.isDeleted()) {
                throw new IllegalArgumentException("Cannot edit a deleted message");
            }
            if (message.getType() != MessageType.TEXT) {
                throw new IllegalArgumentException("Only TEXT messages can be edited");
            }

            message.setContent(request.content().trim());
            message.setEdited(true);
            message.setEditedAt(Instant.now());
            Message saved = messageRepository.save(message);

            if (conversation.getLastMessage() != null && messageId.equals(conversation.getLastMessage().getMessageId())) {
                conversation.getLastMessage().setContent(saved.getContent());
                conversationRepository.save(conversation);
            }

            List<String> recipientIds = conversation.getParticipantIds().stream()
                    .filter(id -> !id.equals(currentUserId))
                    .toList();
            kafkaMessageProducer.publishMessageEdited(new MessageEditedEvent(
                    saved.getId(),
                    conversationId,
                    saved.getContent(),
                    saved.getEditedAt(),
                    recipientIds
            ));

            return MessageResponse.from(saved, MessageDeliveryStatus.DELIVERED);
        }

        Optional<BlockedMessage> blockedMsgOpt = blockedMessageRepository.findById(messageId);
        if (blockedMsgOpt.isPresent()) {
            BlockedMessage blocked = blockedMsgOpt.get();
            if (!conversationId.equals(blocked.getConversationId())) {
                throw new ResourceNotFoundException("Message not found in conversation");
            }
            if (!currentUserId.equals(blocked.getSenderId())) {
                throw new ForbiddenException("You can only edit your own messages");
            }
            if (blocked.isDeleted()) {
                throw new IllegalArgumentException("Cannot edit a deleted message");
            }
            if (blocked.getType() != MessageType.TEXT) {
                throw new IllegalArgumentException("Only TEXT messages can be edited");
            }

            blocked.setContent(request.content().trim());
            blocked.setEdited(true);
            blocked.setEditedAt(Instant.now());
            BlockedMessage saved = blockedMessageRepository.save(blocked);
            // No Kafka publish for blocked messages per ADR 007
            return MessageResponse.from(saved, MessageDeliveryStatus.SENT);
        }

        throw new ResourceNotFoundException("Message not found");
    }

    /**
     * Deletes a message (Delete for Everyone or Delete for Me) per ADR 014.
     *
     * @param conversationId the conversation identifier
     * @param messageId      the ID of the message to delete
     * @param currentUserId  the authenticated user requesting deletion
     * @param mode           deletion mode (FOR_EVERYONE or FOR_ME)
     */
    public void deleteMessage(String conversationId, String messageId, String currentUserId, MessageDeleteMode mode) {
        if (conversationId == null || conversationId.isBlank()) {
            throw new IllegalArgumentException("Conversation ID cannot be blank");
        }
        if (messageId == null || messageId.isBlank()) {
            throw new IllegalArgumentException("Message ID cannot be blank");
        }

        if (mode == null) {
            mode = MessageDeleteMode.FOR_EVERYONE;
        }

        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        if (conversation.getParticipantIds() == null || !conversation.getParticipantIds().contains(currentUserId)) {
            throw new ForbiddenException("User is not a participant in this conversation");
        }

        Optional<Message> normalMsgOpt = messageRepository.findById(messageId);
        if (normalMsgOpt.isPresent()) {
            Message message = normalMsgOpt.get();
            if (!conversationId.equals(message.getConversationId())) {
                throw new ResourceNotFoundException("Message not found in conversation");
            }

            if (mode == MessageDeleteMode.FOR_EVERYONE) {
                boolean isSender = currentUserId.equals(message.getSenderId());
                boolean isAdmin = false;
                if (!isSender && conversation.getType() == ConversationType.GROUP && conversation.getGroupId() != null) {
                    isAdmin = groupRepository.findById(conversation.getGroupId())
                            .map(group -> group.getMembers().stream()
                                    .anyMatch(m -> m.getUserId().equals(currentUserId) && m.getRole() == GroupRole.ADMIN))
                            .orElse(false);
                }

                if (!isSender && !isAdmin) {
                    throw new ForbiddenException("You can only delete your own messages for everyone");
                }

                message.setDeleted(true);
                message.setContent(null);
                messageRepository.save(message);

                if (conversation.getLastMessage() != null && messageId.equals(conversation.getLastMessage().getMessageId())) {
                    conversation.getLastMessage().setContent("This message was deleted");
                    conversationRepository.save(conversation);
                }

                List<String> recipientIds = conversation.getParticipantIds().stream()
                        .filter(id -> !id.equals(currentUserId))
                        .toList();
                kafkaMessageProducer.publishMessageDeleted(new MessageDeletedEvent(
                        message.getId(),
                        conversationId,
                        recipientIds
                ));
            } else {
                // FOR_ME: Append to deletedFor
                if (message.getDeletedFor() == null) {
                    message.setDeletedFor(new ArrayList<>());
                }
                if (!message.getDeletedFor().contains(currentUserId)) {
                    message.getDeletedFor().add(currentUserId);
                    messageRepository.save(message);
                }

                // If user was recipient and message was unread, decrement unread count
                if (!currentUserId.equals(message.getSenderId())) {
                    notificationRepository.decrementUnreadCount(currentUserId, conversationId);
                }
            }
            return;
        }

        Optional<BlockedMessage> blockedMsgOpt = blockedMessageRepository.findById(messageId);
        if (blockedMsgOpt.isPresent()) {
            BlockedMessage blocked = blockedMsgOpt.get();
            if (!conversationId.equals(blocked.getConversationId())) {
                throw new ResourceNotFoundException("Message not found in conversation");
            }

            if (mode == MessageDeleteMode.FOR_EVERYONE) {
                if (!currentUserId.equals(blocked.getSenderId())) {
                    throw new ForbiddenException("You can only delete your own messages for everyone");
                }
                blocked.setDeleted(true);
                blocked.setContent(null);
                blockedMessageRepository.save(blocked);
                // No Kafka broadcast for blocked messages per ADR 007
            } else {
                // FOR_ME: Append to deletedFor
                if (blocked.getDeletedFor() == null) {
                    blocked.setDeletedFor(new ArrayList<>());
                }
                if (!blocked.getDeletedFor().contains(currentUserId)) {
                    blocked.getDeletedFor().add(currentUserId);
                    blockedMessageRepository.save(blocked);
                }
            }
            return;
        }

        throw new ResourceNotFoundException("Message not found");
    }

    /**
     * Marks a message as read by the specified user.
     * Enforces P1-18: Adds the user's ID and timestamp to the message's readBy list if not present,
     * resets the unread count in NotificationRepository for this conversation,
     * and publishes a MessageReadEvent to Kafka topic 'chat.messages.read' for WebSocket fan-out.
     *
     * @param conversationId the conversation identifier
     * @param messageId      the message identifier
     * @param userId         the user marking the message as read
     */
    public void markMessageAsRead(String conversationId, String messageId, String userId) {
        if (conversationId == null || conversationId.isBlank()) {
            throw new IllegalArgumentException("Conversation ID cannot be blank");
        }
        if (messageId == null || messageId.isBlank()) {
            throw new IllegalArgumentException("Message ID cannot be blank");
        }
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User ID cannot be blank");
        }

        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        if (conversation.getParticipantIds() == null || !conversation.getParticipantIds().contains(userId)) {
            throw new ForbiddenException("User is not a participant in this conversation");
        }

        // Always reset conversation unread count for this user
        notificationRepository.markConversationAsRead(userId, conversationId);

        Optional<Message> messageOpt = messageRepository.findById(messageId);
        if (messageOpt.isEmpty()) {
            Optional<BlockedMessage> blockedOpt = blockedMessageRepository.findById(messageId);
            if (blockedOpt.isPresent() && conversationId.equals(blockedOpt.get().getConversationId())) {
                // Blocked messages do not have read receipts per ADR 007
                return;
            }
            throw new ResourceNotFoundException("Message not found: " + messageId);
        }

        Message message = messageOpt.get();
        if (!conversationId.equals(message.getConversationId())) {
            throw new ResourceNotFoundException("Message not found in conversation: " + messageId);
        }

        // Sender cannot generate read receipts for their own message
        if (userId.equals(message.getSenderId())) {
            return;
        }

        if (message.getReadBy() == null) {
            message.setReadBy(new ArrayList<>());
        }

        boolean alreadyRead = message.getReadBy().stream()
                .anyMatch(r -> userId.equals(r.getUserId()));

        if (!alreadyRead) {
            Instant now = Instant.now();
            message.getReadBy().add(new ReadReceipt(userId, now));
            messageRepository.save(message);

            MessageReadEvent event = new MessageReadEvent(conversationId, messageId, userId, now);
            kafkaMessageProducer.publishMessageRead(event);
            log.debug("Message {} in conversation {} marked as read by user {}", messageId, conversationId, userId);
        }
    }

    /**
     * Marks multiple messages as read in bulk in a single request.
     * Enforces participant membership and clears the user's unread notifications once.
     *
     * @param conversationId the conversation identifier
     * @param messageIds     list of message identifiers to mark as read
     * @param userId         the user marking the messages as read
     */
    public void markMessagesAsRead(String conversationId, List<String> messageIds, String userId) {
        if (conversationId == null || conversationId.isBlank()) {
            throw new IllegalArgumentException("Conversation ID cannot be blank");
        }
        if (messageIds == null || messageIds.isEmpty()) {
            return;
        }
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User ID cannot be blank");
        }

        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        if (conversation.getParticipantIds() == null || !conversation.getParticipantIds().contains(userId)) {
            throw new ForbiddenException("User is not a participant in this conversation");
        }

        // Always reset conversation unread count for this user
        notificationRepository.markConversationAsRead(userId, conversationId);

        Instant now = Instant.now();
        List<Message> messages = messageRepository.findAllById(messageIds);
        List<Message> updatedMessages = new ArrayList<>();
        List<MessageReadEvent> eventsToPublish = new ArrayList<>();

        for (Message message : messages) {
            if (!conversationId.equals(message.getConversationId()) || userId.equals(message.getSenderId())) {
                continue;
            }
            if (message.getReadBy() == null) {
                message.setReadBy(new ArrayList<>());
            }
            boolean alreadyRead = message.getReadBy().stream().anyMatch(r -> userId.equals(r.getUserId()));
            if (!alreadyRead) {
                message.getReadBy().add(new ReadReceipt(userId, now));
                updatedMessages.add(message);
                eventsToPublish.add(new MessageReadEvent(conversationId, message.getId(), userId, now));
            }
        }

        if (!updatedMessages.isEmpty()) {
            messageRepository.saveAll(updatedMessages);
            for (MessageReadEvent event : eventsToPublish) {
                kafkaMessageProducer.publishMessageRead(event);
            }
        }
    }
}
