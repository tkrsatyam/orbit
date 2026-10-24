package com.orbit.message;

import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.ForbiddenException;
import com.orbit.common.exception.RateLimitException;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.common.ratelimit.ConsumptionResult;
import com.orbit.common.ratelimit.TokenBucketRateLimiter;
import com.orbit.contact.ContactService;
import com.orbit.conversation.ConversationRepository;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import com.orbit.conversation.model.LastMessageSnapshot;
import com.orbit.message.dto.MessageHistoryResponse;
import com.orbit.message.dto.MessageResponse;
import com.orbit.message.dto.SendMessageRequest;
import com.orbit.message.kafka.KafkaMessageProducer;
import com.orbit.message.kafka.MessageDeliveryEvent;
import com.orbit.message.model.BlockedMessage;
import com.orbit.message.model.Message;
import com.orbit.message.model.MessageType;
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
    private final KafkaMessageProducer kafkaMessageProducer;
    private final TokenBucketRateLimiter rateLimiter;
    private final OrbitProperties properties;

    public MessageService(MessageRepository messageRepository,
                          BlockedMessageRepository blockedMessageRepository,
                          ConversationRepository conversationRepository,
                          NotificationRepository notificationRepository,
                          ContactService contactService,
                          UserRepository userRepository,
                          KafkaMessageProducer kafkaMessageProducer,
                          TokenBucketRateLimiter rateLimiter,
                          OrbitProperties properties) {
        this.messageRepository = messageRepository;
        this.blockedMessageRepository = blockedMessageRepository;
        this.conversationRepository = conversationRepository;
        this.notificationRepository = notificationRepository;
        this.contactService = contactService;
        this.userRepository = userRepository;
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
        int messageLimit = properties.rateLimit().messagesPerMinute();
        ConsumptionResult rateLimitResult = rateLimiter.tryConsume("MESSAGES:user:" + senderId, messageLimit);
        if (!rateLimitResult.allowed()) {
            throw new RateLimitException("Message rate limit exceeded", rateLimitResult.retryAfterSeconds());
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
            return MessageResponse.from(savedBlocked);
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

        // 7. Upsert unread notification counts for all recipients
        for (String recipientId : recipientIds) {
            notificationRepository.incrementUnreadCount(recipientId, conversationId);
        }

        // 8. Publish MessageDeliveryEvent to Kafka chat.messages
        MessageResponse response = MessageResponse.from(savedMessage);
        MessageDeliveryEvent event = new MessageDeliveryEvent(
                savedMessage.getId(),
                conversationId,
                senderId,
                recipientIds,
                response
        );
        kafkaMessageProducer.publishMessage(event);

        // 9. Return receipt to sender
        return response;
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
            messages = messageRepository.findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc(
                    conversationId, cursorCreatedAt, pageRequest);
            blockedMessages = blockedMessageRepository.findByConversationIdAndSenderIdAndCreatedAtLessThanOrderByCreatedAtDesc(
                    conversationId, currentUserId, cursorCreatedAt, pageRequest);
        } else {
            messages = messageRepository.findByConversationIdOrderByCreatedAtDesc(
                    conversationId, pageRequest);
            blockedMessages = blockedMessageRepository.findByConversationIdAndSenderIdOrderByCreatedAtDesc(
                    conversationId, currentUserId, pageRequest);
        }

        List<MessageResponse> combined = new ArrayList<>(messages.size() + blockedMessages.size());
        for (Message m : messages) {
            combined.add(MessageResponse.from(m));
        }
        for (BlockedMessage bm : blockedMessages) {
            combined.add(MessageResponse.from(bm));
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
}
