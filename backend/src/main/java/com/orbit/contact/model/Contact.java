package com.orbit.contact.model;

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
 * Stores connection requests and established contact relationships.
 * See docs/architecture/erd.md (contacts collection).
 */
@Document(collection = "contacts")
@CompoundIndexes({
        @CompoundIndex(name = "requester_receiver_idx", def = "{'requesterId': 1, 'receiverId': 1}", unique = true),
        @CompoundIndex(name = "receiver_status_idx", def = "{'receiverId': 1, 'status': 1}"),
        @CompoundIndex(name = "requester_status_idx", def = "{'requesterId': 1, 'status': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Contact {

    @Id
    private String id;

    @Indexed
    private String requesterId;

    @Indexed
    private String receiverId;

    private ContactStatus status;

    private String conversationId;

    private String blockedBy;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
