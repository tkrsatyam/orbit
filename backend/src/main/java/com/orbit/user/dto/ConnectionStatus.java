package com.orbit.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Expresses the contact relationship between the authenticated requester and a target user.
 */
@Schema(description = "Relationship status between the requester and the target user")
public enum ConnectionStatus {
    NONE,
    PENDING_SENT,
    PENDING_RECEIVED,
    CONNECTED,
    BLOCKED
}
