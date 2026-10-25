package com.orbit.conversation.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Participant summary in direct conversation")
public record ParticipantSummary(
        @Schema(description = "Participant user ID", example = "60c72b2f9b1d8b2bad000001")
        String id,

        @Schema(description = "Display name", example = "Rahul")
        String displayName,

        @Schema(description = "Avatar URL, or null", example = "https://...")
        String avatarUrl,

        @Schema(description = "Live online presence flag", example = "true")
        boolean online
) {
}
