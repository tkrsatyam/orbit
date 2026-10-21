package com.orbit.conversation.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Denormalized snapshot of the last message sent in a conversation.
 * Enables efficient conversation list rendering without loading full message documents.
 * See docs/architecture/erd.md.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LastMessageSnapshot {

    private String messageId;
    private String content;
    private String senderId;
    private String senderName;
    private Instant sentAt;
}
