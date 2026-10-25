package com.orbit.conversation.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "List of conversations for authenticated user")
public record ConversationListResponse(
        @Schema(description = "Array of conversation items")
        List<ConversationResponse> content
) {
}
