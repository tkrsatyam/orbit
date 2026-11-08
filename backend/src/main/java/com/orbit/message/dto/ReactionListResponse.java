package com.orbit.message.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "List of reactions on a message")
public record ReactionListResponse(
        @Schema(description = "Array of reactions")
        List<ReactionResponse> reactions
) {}
