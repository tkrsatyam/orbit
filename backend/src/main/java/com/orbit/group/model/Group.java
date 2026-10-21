package com.orbit.group.model;

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
 * Stores group metadata, membership, roles, invite tokens, and pinned message snapshots.
 * See docs/architecture/erd.md (groups collection).
 */
@Document(collection = "groups")
@CompoundIndexes({
        @CompoundIndex(name = "visibility_topic_idx", def = "{'visibility': 1, 'topicTag': 1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Group {

    @Id
    private String id;

    @Indexed(unique = true)
    private String name;

    private String description;

    @Indexed
    private String topicTag;

    private GroupVisibility visibility;

    private String avatarUrl;

    private String coverImageUrl;

    @Indexed
    private String conversationId;

    @Builder.Default
    private List<GroupMember> members = new ArrayList<>();

    @Indexed(sparse = true)
    private String inviteToken;

    private Instant inviteTokenExpiresAt;

    @Builder.Default
    private List<PinnedMessageSnapshot> pinnedMessages = new ArrayList<>();

    @Builder.Default
    private int memberCount = 1;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
