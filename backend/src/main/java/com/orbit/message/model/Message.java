package com.orbit.message.model;

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
import java.util.ArrayList;
import java.util.List;

/**
 * Primary message document stored in the 'messages' collection.
 * See docs/architecture/erd.md (messages collection).
 */
@Document(collection = "messages")
@CompoundIndexes({
        @CompoundIndex(name = "conv_created_idx", def = "{'conversationId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "conv_id_idx", def = "{'conversationId': 1, '_id': -1}"),
        @CompoundIndex(name = "conv_idempotency_idx", def = "{'conversationId': 1, 'idempotencyKey': 1}", sparse = true),
        @CompoundIndex(name = "conv_deletedfor_created_idx", def = "{'conversationId': 1, 'deletedFor': 1, 'createdAt': -1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message {

    @Id
    private String id;

    @Indexed
    private String conversationId;

    @Indexed
    private String senderId;

    private String senderName;

    @Builder.Default
    private MessageType type = MessageType.TEXT;

    private String content;

    @Builder.Default
    private boolean deleted = false;

    @Builder.Default
    private List<String> deletedFor = new ArrayList<>();

    @Builder.Default
    private boolean edited = false;

    private Instant editedAt;

    @Builder.Default
    private List<ReadReceipt> readBy = new ArrayList<>();

    @Indexed(sparse = true)
    private String idempotencyKey;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
