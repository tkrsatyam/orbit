package com.orbit.message.kafka;

import java.time.Instant;
import java.util.List;

/**
 * Event published to Kafka topic 'chat.messages.edited'.
 */
public record MessageEditedEvent(
        String messageId,
        String conversationId,
        String content,
        Instant editedAt,
        List<String> recipientIds
) {}
