package com.orbit.presence;

import com.orbit.contact.ContactService;
import com.orbit.conversation.ConversationRepository;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import com.orbit.message.kafka.KafkaMessageProducer;
import com.orbit.presence.dto.PresenceEvent;
import com.orbit.presence.dto.TypingEvent;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Handles online/offline state transitions and ephemeral typing indicators.
 * Follows docs/architecture/sequences/presence_flow.md.
 */
@Service
public class PresenceService {

    private static final Logger log = LoggerFactory.getLogger(PresenceService.class);

    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final ContactService contactService;
    private final KafkaMessageProducer kafkaMessageProducer;

    public PresenceService(ConversationRepository conversationRepository,
                           UserRepository userRepository,
                           ContactService contactService,
                           KafkaMessageProducer kafkaMessageProducer) {
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
        this.contactService = contactService;
        this.kafkaMessageProducer = kafkaMessageProducer;
    }

    /**
     * Handles user coming online (first WebSocket session connected).
     * Updates users.online = true, sets lastSeen = now, and publishes PresenceEvent to Kafka.
     * Follows Flow A from docs/architecture/sequences/presence_flow.md.
     *
     * @param userId user ID who connected
     */
    public void handleConnect(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        Instant now = Instant.now();
        userRepository.findById(userId).ifPresent(user -> {
            user.setOnline(true);
            user.setLastSeen(now);
            userRepository.save(user);
            log.info("User {} marked online", userId);
        });

        PresenceEvent event = new PresenceEvent(userId, true, now);
        kafkaMessageProducer.publishPresence(event);
    }

    /**
     * Handles user going offline (last WebSocket session disconnected).
     * Updates users.online = false, sets lastSeen = now, and publishes PresenceEvent to Kafka.
     * Follows Flow C from docs/architecture/sequences/presence_flow.md.
     *
     * @param userId user ID who disconnected
     */
    public void handleDisconnect(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }

        Instant now = Instant.now();
        userRepository.findById(userId).ifPresent(user -> {
            user.setOnline(false);
            user.setLastSeen(now);
            userRepository.save(user);
            log.info("User {} marked offline, lastSeen={}", userId, now);
        });

        PresenceEvent event = new PresenceEvent(userId, false, now);
        kafkaMessageProducer.publishPresence(event);
    }

    /**
     * Handles an ephemeral typing indicator event.
     * Zero MongoDB writes.
     * In 1:1 direct conversations, suppresses event if the typing user is blocked by the other participant.
     *
     * @param conversationId conversation ID
     * @param userId ID of user typing
     * @param typing true if typing, false if stopped
     */
    public void handleTyping(String conversationId, String userId, boolean typing) {
        if (conversationId == null || userId == null) {
            return;
        }

        Optional<Conversation> convOpt = conversationRepository.findById(conversationId);
        if (convOpt.isEmpty()) {
            log.warn("Typing event for non-existent conversation: conversationId={}", conversationId);
            return;
        }

        Conversation conversation = convOpt.get();
        if (conversation.getParticipantIds() == null || !conversation.getParticipantIds().contains(userId)) {
            log.warn("User {} is not a participant in conversation {}", userId, conversationId);
            return;
        }

        // Block status check for 1:1 direct conversations (ADR 007 Decision 8)
        if (conversation.getType() == ConversationType.DIRECT) {
            List<String> recipients = conversation.getParticipantIds().stream()
                    .filter(id -> !id.equals(userId))
                    .toList();
            if (!recipients.isEmpty()) {
                String recipientId = recipients.get(0);
                if (contactService.isBlockedBy(userId, recipientId)) {
                    log.debug("Suppressing typing indicator from blocked user {} to blocker {}", userId, recipientId);
                    return;
                }
            }
        }

        String displayName = userRepository.findById(userId)
                .map(User::getDisplayName)
                .orElse("Orbit User");

        TypingEvent event = new TypingEvent(conversationId, userId, displayName, typing);
        kafkaMessageProducer.publishTyping(event);
    }
}
