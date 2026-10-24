package com.orbit.message.model;

/**
 * Deletion modes for messages per ADR 014.
 */
public enum MessageDeleteMode {
    /**
     * Soft-deletes message for all participants, showing 'This message was deleted'.
     */
    FOR_EVERYONE,

    /**
     * Deletes message solely from the requesting user's view; leaves other participants' view intact.
     */
    FOR_ME
}
