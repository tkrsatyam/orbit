package com.orbit.message.kafka;

import java.util.List;

/**
 * Event published to Kafka topic 'chat.messages.deleted'.
 */
public record MessageDeletedEvent(
        String messageId,
        String conversationId,
        List<String> recipientIds
) {}
