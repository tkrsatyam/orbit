package com.orbit.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Real-time personal notification payload pushed to user queue /user/queue/notifications.
 */
@Schema(description = "Real-time personal notification payload")
public record NotificationPayload(
        @Schema(description = "Notification type", example = "UNREAD_COUNT")
        String type,

        @Schema(description = "ID of associated conversation", example = "64f1a2b3c4d5e6f7a8b9c0e1")
        String conversationId,

        @Schema(description = "Unread count for the conversation", example = "5")
        Integer count
) {}
