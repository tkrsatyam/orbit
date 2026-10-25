package com.orbit.message.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

@Schema(description = "Payload to mark multiple messages as read in bulk")
public record BatchReadRequest(
        @Schema(description = "List of message IDs to mark as read")
        @NotEmpty(message = "messageIds list must not be empty")
        List<String> messageIds
) {}
