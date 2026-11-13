package com.orbit.message.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Embedded emoji reaction in Message and BlockedMessage documents.
 * See docs/architecture/erd.md (messages.reactions).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Reaction {
    private String userId;
    private String displayName;
    private String emoji;
    private Instant createdAt;
}
