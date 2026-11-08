package com.orbit.message.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Embedded snapshot of a quoted message in Message and BlockedMessage documents.
 * Captured at reply time — immutable even if original message is edited or deleted.
 * See docs/architecture/erd.md (messages.quotedMessage).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuotedMessage {
    private String messageId;
    private String content;
    private String senderId;
    private String senderName;
    private MessageType type;
}
