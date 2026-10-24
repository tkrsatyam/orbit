package com.orbit.message.dto;

import com.orbit.message.model.MessageType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Payload to send a message within a conversation")
public record SendMessageRequest(
        @NotBlank(message = "Message content cannot be blank")
        @Size(min = 1, max = 4000, message = "Message content must not exceed 4000 characters")
        @Schema(description = "Content text of the message", example = "Hey! Have you checked the latest ADR?", minLength = 1)
        String content,

        @Schema(description = "Message type", example = "TEXT", defaultValue = "TEXT")
        MessageType type,

        @Schema(description = "Client-generated idempotency key (UUID)", example = "c8f2b7a4-3995-4672-9a0f-1558914619a9", nullable = true)
        String idempotencyKey
) {
    public SendMessageRequest(String content) {
        this(content, MessageType.TEXT, null);
    }

    public SendMessageRequest(String content, MessageType type) {
        this(content, type, null);
    }
}
