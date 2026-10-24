package com.orbit.message.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Payload broadcast to /topic/conversations/{id}/messages/edited")
public record MessageEditedNotification(
        @Schema(description = "ID of edited message")
        String messageId,

        @Schema(description = "Updated content")
        String content,

        @Schema(description = "Timestamp when message was edited")
        Instant editedAt
) {}
