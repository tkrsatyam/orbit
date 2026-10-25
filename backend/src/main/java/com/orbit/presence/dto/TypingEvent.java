package com.orbit.presence.dto;

/**
 * Ephemeral Kafka event published to topic 'chat.presence' for multi-instance fan-out.
 * Keyed by conversationId to guarantee in-order delivery.
 * Zero database writes.
 * See docs/architecture/sequences/presence_flow.md Flow B.
 */
public record TypingEvent(
        String conversationId,
        String userId,
        String displayName,
        boolean typing
) {}
