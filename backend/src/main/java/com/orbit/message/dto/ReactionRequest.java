package com.orbit.message.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Payload to add or toggle an emoji reaction on a message")
public record ReactionRequest(
        @NotBlank(message = "Emoji cannot be blank")
        @Size(max = 16, message = "Emoji string must not exceed 16 characters")
        @Schema(description = "Unicode emoji character", example = "👍")
        String emoji
) {}
