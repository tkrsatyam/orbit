package com.orbit.presence.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "WebSocket notification payload for user presence updates")
public record PresenceNotification(
        @Schema(description = "User ID whose presence state updated", example = "60c72b2f9b1d8b2bad000001")
        String userId,

        @Schema(description = "True if currently online, false otherwise", example = "true")
        boolean online,

        @Schema(description = "Timestamp when user was last seen")
        Instant lastSeen
) {
}
