package com.orbit.group.model;

/**
 * Visibility of a group determining discoverability and join mechanisms.
 * PUBLIC groups are discoverable and joinable by anyone.
 * PRIVATE groups require an invite token to join.
 * See docs/architecture/erd.md and docs/REQUIREMENTS.md (P1-21, P1-22, P1-23).
 */
public enum GroupVisibility {
    PUBLIC,
    PRIVATE
}
