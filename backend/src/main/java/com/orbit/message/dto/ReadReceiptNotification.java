package com.orbit.message.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "WebSocket payload fanned out when a message is read")
public record ReadReceiptNotification(
        @Schema(description = "Message ID that was read", example = "60c72b2f9b1d8b2bad000001")
        String messageId,

        @Schema(description = "ID of user who read the message", example = "60c72b2f9b1d8b2bad000002")
        String userId,

        @Schema(description = "Timestamp when the message was marked as read")
        Instant readAt
) {
}
