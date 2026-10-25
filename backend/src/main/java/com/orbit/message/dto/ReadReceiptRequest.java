package com.orbit.message.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Payload to mark a message as read")
public record ReadReceiptRequest(
        @NotBlank(message = "Message ID is required")
        @Schema(description = "Unique identifier of the message marked as read", example = "60c72b2f9b1d8b2bad000001")
        String messageId
) {
}
