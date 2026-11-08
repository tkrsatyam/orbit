package com.orbit.message.dto;

import com.orbit.message.model.MessageType;
import com.orbit.message.model.QuotedMessage;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Embedded snapshot of a quoted message")
public record QuotedMessageResponse(
        @Schema(description = "Target message ID (for UI navigation)", example = "60c72b2f9b1d8b2bad000001")
        String messageId,

        @Schema(description = "Snapshot of message content at reply time", example = "Has anyone tried the course?")
        String content,

        @Schema(description = "Author user ID of original message", example = "60c72b2f9b1d8b2bad000003")
        String senderId,

        @Schema(description = "Author display name of original message", example = "Satyam Kumar")
        String senderName,

        @Schema(description = "Original message type", example = "TEXT")
        MessageType type
) {
    public static QuotedMessageResponse from(QuotedMessage quotedMessage) {
        if (quotedMessage == null) {
            return null;
        }
        return new QuotedMessageResponse(
                quotedMessage.getMessageId(),
                quotedMessage.getContent(),
                quotedMessage.getSenderId(),
                quotedMessage.getSenderName(),
                quotedMessage.getType()
        );
    }
}
