package com.orbit.websocket;

import com.orbit.message.dto.MessageDeletedNotification;
import com.orbit.message.dto.MessageEditedNotification;
import com.orbit.message.dto.MessageResponse;
import com.orbit.message.dto.ReadReceiptNotification;
import com.orbit.message.kafka.MessageDeletedEvent;
import com.orbit.message.kafka.MessageDeliveryEvent;
import com.orbit.message.kafka.MessageEditedEvent;
import com.orbit.message.kafka.MessageReadEvent;
import com.orbit.notification.dto.NotificationEvent;
import com.orbit.notification.dto.NotificationPayload;
import com.orbit.presence.dto.PresenceEvent;
import com.orbit.presence.dto.PresenceNotification;
import com.orbit.presence.dto.TypingEvent;
import com.orbit.presence.dto.TypingNotification;
import io.github.springwolf.bindings.stomp.annotations.StompAsyncOperationBinding;
import io.github.springwolf.core.asyncapi.annotations.AsyncOperation;
import io.github.springwolf.core.asyncapi.annotations.AsyncPublisher;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Consumes events from Kafka (chat.messages, chat.messages.edited, chat.messages.deleted,
 * chat.messages.read, chat.presence, chat.notifications) and forwards them to local WebSocket sessions.
 * Follows Flow D (Multi-Instance Fan-Out) from docs/architecture/sequences/message_send_flow.md.
 */
@Component
public class KafkaWebSocketBridge {

    private static final Logger log = LoggerFactory.getLogger(KafkaWebSocketBridge.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketSessionRegistry sessionRegistry;

    public KafkaWebSocketBridge(SimpMessagingTemplate messagingTemplate,
                                WebSocketSessionRegistry sessionRegistry) {
        this.messagingTemplate = messagingTemplate;
        this.sessionRegistry = sessionRegistry;
    }

    /**
     * Consumes message delivery events and fans out to local WebSocket sessions.
     * If this instance holds an active session for any recipient, it broadcasts to
     * /topic/conversations/{conversationId}/messages.
     * Instances with no relevant sessions discard the event silently.
     */
    @KafkaListener(topics = "chat.messages", groupId = "orbit-websocket-group")
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = "/topic/conversations/{conversationId}/messages",
                    description = "Broadcasts new message delivery event to all connected subscribers in the conversation.",
                    payloadType = MessageResponse.class
            )
    )
    @StompAsyncOperationBinding
    public void handleChatMessage(MessageDeliveryEvent event) {
        if (event == null || event.recipientIds() == null) {
            return;
        }

        boolean hasLocalRecipient = event.recipientIds().stream()
                .anyMatch(sessionRegistry::isOnline);

        if (hasLocalRecipient) {
            log.debug("Delivering real-time message to local subscribers: conversationId={}, messageId={}",
                    event.conversationId(), event.messageId());
            String destination = "/topic/conversations/" + event.conversationId() + "/messages";
            messagingTemplate.convertAndSend(destination, event.message());
        } else {
            log.trace("Discarding chat.messages event: no local active sessions for recipients of conversationId={}",
                    event.conversationId());
        }
    }

    /**
     * Consumes message edited events and fans out to /topic/conversations/{conversationId}/messages/edited.
     */
    @KafkaListener(topics = "chat.messages.edited", groupId = "orbit-websocket-group")
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = "/topic/conversations/{conversationId}/messages/edited",
                    description = "Broadcasts message edit notifications to all subscribers in the conversation.",
                    payloadType = MessageEditedNotification.class
            )
    )
    @StompAsyncOperationBinding
    public void handleMessageEdited(MessageEditedEvent event) {
        if (event == null || event.conversationId() == null) {
            return;
        }

        log.debug("Delivering real-time message edit to subscribers: conversationId={}, messageId={}",
                event.conversationId(), event.messageId());
        String destination = "/topic/conversations/" + event.conversationId() + "/messages/edited";
        messagingTemplate.convertAndSend(destination,
                new MessageEditedNotification(event.messageId(), event.content(), event.editedAt()));
    }

    /**
     * Consumes message deleted events and fans out to /topic/conversations/{conversationId}/messages/deleted.
     */
    @KafkaListener(topics = "chat.messages.deleted", groupId = "orbit-websocket-group")
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = "/topic/conversations/{conversationId}/messages/deleted",
                    description = "Broadcasts message deletion notifications to all subscribers in the conversation.",
                    payloadType = MessageDeletedNotification.class
            )
    )
    @StompAsyncOperationBinding
    public void handleMessageDeleted(MessageDeletedEvent event) {
        if (event == null || event.conversationId() == null) {
            return;
        }

        log.debug("Delivering real-time message delete to subscribers: conversationId={}, messageId={}",
                event.conversationId(), event.messageId());
        String destination = "/topic/conversations/" + event.conversationId() + "/messages/deleted";
        messagingTemplate.convertAndSend(destination,
                new MessageDeletedNotification(event.messageId()));
    }

    /**
     * Consumes message read events and fans out to /topic/conversations/{conversationId}/read.
     */
    @KafkaListener(topics = "chat.messages.read", groupId = "orbit-websocket-group")
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = "/topic/conversations/{conversationId}/read",
                    description = "Broadcasts read receipt status transitions to conversation participants.",
                    payloadType = ReadReceiptNotification.class
            )
    )
    @StompAsyncOperationBinding
    public void handleMessageRead(MessageReadEvent event) {
        if (event == null || event.conversationId() == null) {
            return;
        }

        log.debug("Delivering real-time read receipt to subscribers: conversationId={}, messageId={}, userId={}",
                event.conversationId(), event.messageId(), event.userId());
        String destination = "/topic/conversations/" + event.conversationId() + "/read";
        messagingTemplate.convertAndSend(destination,
                new ReadReceiptNotification(event.messageId(), event.userId(), event.readAt()));
    }

    /**
     * Consumes presence and typing events from Kafka topic 'chat.presence'.
     */
    @KafkaListener(topics = "chat.presence", groupId = "orbit-websocket-group")
    public void handlePresenceOrTyping(Object event) {
        Object payload = event;
        if (event instanceof ConsumerRecord<?, ?> record) {
            payload = record.value();
        }
        if (payload instanceof TypingEvent typingEvent) {
            handleTyping(typingEvent);
        } else if (payload instanceof PresenceEvent presenceEvent) {
            handlePresence(presenceEvent);
        } else {
            log.warn("Unrecognized event type on chat.presence topic: {}", payload != null ? payload.getClass().getName() : "null");
        }
    }

    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = "/topic/conversations/{conversationId}/typing",
                    description = "Broadcasts ephemeral typing indicators to conversation participants.",
                    payloadType = TypingNotification.class
            )
    )
    @StompAsyncOperationBinding
    public void handleTyping(TypingEvent event) {
        if (event == null || event.conversationId() == null) {
            return;
        }

        log.debug("Delivering real-time typing indicator to subscribers: conversationId={}, userId={}, typing={}",
                event.conversationId(), event.userId(), event.typing());
        String destination = "/topic/conversations/" + event.conversationId() + "/typing";
        messagingTemplate.convertAndSend(destination,
                new TypingNotification(event.userId(), event.displayName(), event.typing()));
    }

    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = "/topic/presence/{userId}",
                    description = "Broadcasts user online/offline status and lastSeen timestamp updates to contacts and group members.",
                    payloadType = PresenceNotification.class
            )
    )
    @StompAsyncOperationBinding
    public void handlePresence(PresenceEvent event) {
        if (event == null || event.userId() == null) {
            return;
        }

        log.debug("Delivering real-time presence update: userId={}, online={}",
                event.userId(), event.online());
        String destination = "/topic/presence/" + event.userId();
        messagingTemplate.convertAndSend(destination,
                new PresenceNotification(event.userId(), event.online(), event.lastSeen()));
    }

    /**
     * Consumes personal notifications from Kafka topic 'chat.notifications' and delivers to /user/queue/notifications.
     */
    @KafkaListener(topics = "chat.notifications", groupId = "orbit-websocket-group")
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = "/user/queue/notifications",
                    description = "Pushes real-time personal notification (unread count, mention) to user private queue.",
                    payloadType = NotificationPayload.class
            )
    )
    @StompAsyncOperationBinding
    public void handleNotification(NotificationEvent event) {
        if (event == null || event.userId() == null) {
            return;
        }

        if (sessionRegistry.isOnline(event.userId())) {
            log.debug("Delivering real-time notification to user={}: type={}",
                    event.userId(), event.payload() != null ? event.payload().type() : null);
            messagingTemplate.convertAndSendToUser(event.userId(), "/queue/notifications", event.payload());
        }
    }
}

