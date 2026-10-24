package com.orbit.presence.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

/**
 * Payload sent by client over STOMP to /app/conversations/{conversationId}/typing.
 */
public record TypingRequest(
        @NotNull(message = "typing field is required")
        @JsonProperty("typing")
        Boolean typing
) {}
