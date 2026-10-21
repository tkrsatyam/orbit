package com.orbit.contact.dto;

import com.orbit.contact.model.ContactStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Response payload returned upon successfully sending a connection request.
 * See docs/API_CONTRACTS.md (POST /api/v1/contacts/requests).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConnectionRequestResponse {

    private String id;
    private ContactStatus status;
    private ContactUserSummaryDto toUser;
    private Instant createdAt;
}
