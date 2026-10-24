package com.orbit.message.kafka;

import com.orbit.message.dto.MessageResponse;

import java.util.List;

/**
 * Event published to Kafka topic 'chat.messages' for fan-out to active WebSocket sessions.
 * Keyed by conversationId.
 */
public record MessageDeliveryEvent(
        String messageId,
        String conversationId,
        String senderId,
        List<String> recipientIds,
        MessageResponse message
) {}
