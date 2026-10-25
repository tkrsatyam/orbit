package com.orbit.presence.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Payload broadcast by WebSocket broker to /topic/conversations/{conversationId}/typing.
 * See docs/API_CONTRACTS.md.
 */
@Schema(description = "Payload broadcast to /topic/conversations/{conversationId}/typing")
public record TypingNotification(
        @Schema(description = "ID of user who is typing")
        String userId,

        @Schema(description = "Display name of user who is typing")
        String displayName,

        @Schema(description = "Whether user is actively typing")
        boolean typing
) {}
