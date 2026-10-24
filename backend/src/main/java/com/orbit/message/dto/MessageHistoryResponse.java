package com.orbit.message.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Paginated message history envelope")
public record MessageHistoryResponse(
        @Schema(description = "List of messages in chronological order (oldest to newest in this batch)")
        List<MessageResponse> content,

        @Schema(description = "Indicates whether older messages exist before this batch", example = "true")
        boolean hasMore,

        @Schema(description = "Cursor (message ID) to pass as 'before' parameter to load previous messages", example = "60c72b2f9b1d8b2bad000001")
        String nextCursor
) {}
