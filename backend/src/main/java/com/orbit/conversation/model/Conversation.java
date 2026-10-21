package com.orbit.conversation.model;

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
 * Stores conversation metadata and participant references.
 * Acts as the join point between participants and their messages.
 * See docs/architecture/erd.md (conversations collection).
 */
@Document(collection = "conversations")
@CompoundIndexes({
        @CompoundIndex(name = "participants_type_idx", def = "{'participantIds': 1, 'type': 1}"),
        @CompoundIndex(name = "last_message_sent_at_idx", def = "{'lastMessage.sentAt': -1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conversation {

    @Id
    private String id;

    private ConversationType type;

    @Indexed
    @Builder.Default
    private List<String> participantIds = new ArrayList<>();

    @Indexed(sparse = true)
    private String groupId;

    private LastMessageSnapshot lastMessage;

    @Builder.Default
    private List<String> mutedBy = new ArrayList<>();

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
