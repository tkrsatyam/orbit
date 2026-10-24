package com.orbit.message.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Request payload to edit a text message")
public record EditMessageRequest(
        @Schema(description = "Updated text content", example = "Hey! Have you checked the latest ADR? It's updated.")
        @NotBlank(message = "Message content cannot be blank")
        @Size(max = 4000, message = "Message content must not exceed 4000 characters")
        String content
) {}
