package com.orbit.message.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "WebSocket notification payload broadcast when message reactions update")
public record MessageReactionNotification(
        @Schema(description = "Message ID whose reactions updated", example = "60c72b2f9b1d8b2bad000001")
        String messageId,

        @Schema(description = "Conversation ID", example = "60c72b2f9b1d8b2bad000002")
        String conversationId,

        @Schema(description = "Updated reactions list")
        List<ReactionResponse> reactions
) {}
