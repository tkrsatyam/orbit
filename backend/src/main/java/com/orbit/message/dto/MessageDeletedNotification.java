package com.orbit.message.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Payload broadcast to /topic/conversations/{id}/messages/deleted")
public record MessageDeletedNotification(
        @Schema(description = "ID of deleted message")
        String messageId
) {}
