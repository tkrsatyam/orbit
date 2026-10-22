package com.orbit.group.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Embedded member entry in the groups collection.
 * See docs/architecture/erd.md.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupMember {

    private String userId;

    private GroupRole role;

    @Builder.Default
    private Instant joinedAt = Instant.now();
}
