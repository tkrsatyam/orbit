package com.orbit.websocket;

import com.orbit.message.kafka.MessageDeliveryEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Consumes events from Kafka (chat.messages, chat.presence) and forwards them to local WebSocket sessions.
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
}
