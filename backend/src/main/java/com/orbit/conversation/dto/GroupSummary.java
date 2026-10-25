package com.orbit.conversation.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Group summary in group conversation")
public record GroupSummary(
        @Schema(description = "Group ID", example = "60c72b2f9b1d8b2bad000002")
        String id,

        @Schema(description = "Group name", example = "FAANG Interview Prep")
        String name,

        @Schema(description = "Group avatar URL, or null", example = "https://...")
        String avatarUrl,

        @Schema(description = "Member count", example = "24")
        int memberCount
) {
}
