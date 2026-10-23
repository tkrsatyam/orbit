package com.orbit.notification.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Stores notification metadata and unread counts per user per conversation.
 * See docs/architecture/erd.md (notifications collection).
 */
@Document(collection = "notifications")
@CompoundIndexes({
        @CompoundIndex(name = "user_read_idx", def = "{'userId': 1, 'read': 1}"),
        @CompoundIndex(name = "user_conversation_idx", def = "{'userId': 1, 'conversationId': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    private String id;

    @Indexed
    private String userId;

    @Builder.Default
    private NotificationType type = NotificationType.UNREAD_MESSAGE;

    @Indexed
    private String conversationId;

    private String messageId;

    @Builder.Default
    private int count = 0;

    @Builder.Default
    private boolean read = false;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
