package com.orbit.message.dto;

import com.orbit.message.model.Reaction;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Reaction representation on a message")
public record ReactionResponse(
        @Schema(description = "Unicode emoji character", example = "👍")
        String emoji,

        @Schema(description = "ID of user who reacted", example = "60c72b2f9b1d8b2bad000003")
        String userId,

        @Schema(description = "Display name snapshot of reacting user", example = "Satyam Kumar")
        String displayName,

        @Schema(description = "Timestamp when reaction was added")
        Instant createdAt
) {
    public static ReactionResponse from(Reaction reaction) {
        return new ReactionResponse(
                reaction.getEmoji(),
                reaction.getUserId(),
                reaction.getDisplayName(),
                reaction.getCreatedAt()
        );
    }
}
