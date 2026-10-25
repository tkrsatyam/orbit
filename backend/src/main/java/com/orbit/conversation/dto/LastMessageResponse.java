package com.orbit.conversation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "Last message snapshot in conversation")
public record LastMessageResponse(
        @Schema(description = "Message content", example = "Have you tried the system design mock?")
        String content,

        @Schema(description = "Sender user ID (for direct messages)", example = "60c72b2f9b1d8b2bad000001")
        String senderId,

        @Schema(description = "Sender display name (for group messages)", example = "Priya")
        String senderDisplayName,

        @Schema(description = "Timestamp when sent")
        Instant sentAt
) {
}
