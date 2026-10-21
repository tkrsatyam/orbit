package com.orbit.contact.dto;

/**
 * Action taken when responding to an incoming connection request.
 * See docs/API_CONTRACTS.md (PATCH /api/v1/contacts/requests/{requestId}).
 */
public enum RequestAction {
    ACCEPT,
    DECLINE
}
