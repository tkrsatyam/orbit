package com.orbit.message.kafka;

import java.time.Instant;

/**
 * Event published to Kafka topic 'chat.messages.read' for multi-instance fan-out.
 */
public record MessageReadEvent(
        String conversationId,
        String messageId,
        String userId,
        Instant readAt
) {
}
