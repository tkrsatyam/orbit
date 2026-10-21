package com.orbit.contact.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Representation of an established contact relationship in the authenticated user's contact list.
 * See docs/API_CONTRACTS.md (GET /api/v1/contacts).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactResponse {

    private String id;
    private String userId;
    private String displayName;
    private String avatarUrl;
    private String bio;
    private boolean online;
    private String conversationId;
}
