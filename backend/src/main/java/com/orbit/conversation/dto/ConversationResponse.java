package com.orbit.conversation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.orbit.conversation.model.ConversationType;
import io.swagger.v3.oas.annotations.media.Schema;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "Conversation list item representation")
public record ConversationResponse(
        @Schema(description = "Conversation ID", example = "60c72b2f9b1d8b2bad000001")
        String id,

        @Schema(description = "Conversation type: DIRECT or GROUP", example = "DIRECT")
        ConversationType type,

        @Schema(description = "Participant summary for DIRECT conversations")
        ParticipantSummary participant,

        @Schema(description = "Group summary for GROUP conversations")
        GroupSummary group,

        @Schema(description = "Last message snapshot")
        LastMessageResponse lastMessage,

        @Schema(description = "Server-side unread message count", example = "3")
        int unreadCount,

        @Schema(description = "Mute status for current user", example = "false")
        boolean muted
) {
}
