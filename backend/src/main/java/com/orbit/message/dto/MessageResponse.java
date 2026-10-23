package com.orbit.message.dto;

import com.orbit.message.model.BlockedMessage;
import com.orbit.message.model.Message;
import com.orbit.message.model.MessageType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Response representation of a message")
public record MessageResponse(
        @Schema(description = "Unique message ID", example = "60c72b2f9b1d8b2bad000001")
        String id,

        @Schema(description = "Conversation ID", example = "60c72b2f9b1d8b2bad000002")
        String conversationId,

        @Schema(description = "Sender user ID", example = "60c72b2f9b1d8b2bad000003")
        String senderId,

        @Schema(description = "Sender display name snapshot", example = "Satyam Kumar")
        String senderName,

        @Schema(description = "Message type", example = "TEXT")
        MessageType type,

        @Schema(description = "Message text content", example = "Hey! Have you checked the latest ADR?")
        String content,

        @Schema(description = "Soft delete indicator", example = "false")
        boolean deleted,

        @Schema(description = "Edited indicator", example = "false")
        boolean edited,

        @Schema(description = "Timestamp when message was created")
        Instant createdAt
) {
    public static MessageResponse from(Message message) {
        return new MessageResponse(
                message.getId(),
                message.getConversationId(),
                message.getSenderId(),
                message.getSenderName(),
                message.getType(),
                message.getContent(),
                message.isDeleted(),
                message.isEdited(),
                message.getCreatedAt()
        );
    }

    public static MessageResponse from(BlockedMessage message) {
        return new MessageResponse(
                message.getId(),
                message.getConversationId(),
                message.getSenderId(),
                message.getSenderName(),
                message.getType(),
                message.getContent(),
                message.isDeleted(),
                message.isEdited(),
                message.getCreatedAt()
        );
    }
}
