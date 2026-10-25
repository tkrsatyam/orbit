package com.orbit.presence.dto;

import java.time.Instant;

/**
 * Event published to Kafka topic 'chat.presence' for multi-instance presence fan-out.
 */
public record PresenceEvent(
        String userId,
        boolean online,
        Instant lastSeen
) {
}
