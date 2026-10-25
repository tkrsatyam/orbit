package com.orbit.message.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Embedded read receipt in Message document.
 * See docs/architecture/erd.md (messages.readBy).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReadReceipt {
    private String userId;
    private Instant readAt;
}
