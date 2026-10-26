package com.orbit.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Event published to Kafka topic 'chat.notifications' for multi-instance notification fan-out.
 */
@Schema(description = "Kafka event for chat.notifications topic")
public record NotificationEvent(
        @Schema(description = "Recipient user ID", example = "64f1a2b3c4d5e6f7a8b9c0d2")
        String userId,

        @Schema(description = "Notification payload")
        NotificationPayload payload
) {}
