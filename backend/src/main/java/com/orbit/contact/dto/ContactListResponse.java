package com.orbit.contact.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Envelope containing the list of established contacts for the authenticated user.
 * See docs/API_CONTRACTS.md (GET /api/v1/contacts).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactListResponse {

    @Builder.Default
    private List<ContactResponse> content = new ArrayList<>();
}
