package com.orbit.group.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Embedded snapshot of a pinned message in the group document.
 * Maximum of 10 pins per group.
 * See docs/architecture/erd.md and docs/discussions/009_pin_limit_overflow.md.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PinnedMessageSnapshot {

    private String messageId;

    private String content;

    private String senderId;

    private String senderName;

    private String pinnedBy;

    private Instant pinnedAt;
}
