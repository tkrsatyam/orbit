package com.orbit.message.dto;

import com.orbit.message.model.BlockedMessage;
import com.orbit.message.model.Message;
import com.orbit.message.model.MessageDeliveryStatus;
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
        Instant createdAt,

        @Schema(description = "Delivery status of the message", example = "DELIVERED")
        MessageDeliveryStatus deliveryStatus
) {
    public MessageResponse(String id, String conversationId, String senderId, String senderName,
                           MessageType type, String content, boolean deleted, boolean edited,
                           Instant createdAt) {
        this(id, conversationId, senderId, senderName, type, content, deleted, edited, createdAt, MessageDeliveryStatus.DELIVERED);
    }

    public static MessageResponse from(Message message) {
        return from(message, MessageDeliveryStatus.DELIVERED);
    }

    public static MessageResponse from(Message message, MessageDeliveryStatus deliveryStatus) {
        String content = message.isDeleted() ? null : message.getContent();
        return new MessageResponse(
                message.getId(),
                message.getConversationId(),
                message.getSenderId(),
                message.getSenderName(),
                message.getType(),
                content,
                message.isDeleted(),
                message.isEdited(),
                message.getCreatedAt(),
                deliveryStatus
        );
    }

    public static MessageResponse from(BlockedMessage message) {
        return from(message, MessageDeliveryStatus.SENT);
    }

    public static MessageResponse from(BlockedMessage message, MessageDeliveryStatus deliveryStatus) {
        String content = message.isDeleted() ? null : message.getContent();
        return new MessageResponse(
                message.getId(),
                message.getConversationId(),
                message.getSenderId(),
                message.getSenderName(),
                message.getType(),
                content,
                message.isDeleted(),
                message.isEdited(),
                message.getCreatedAt(),
                deliveryStatus
        );
    }
}
