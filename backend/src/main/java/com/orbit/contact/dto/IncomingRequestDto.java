package com.orbit.contact.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Representation of a pending incoming connection request.
 * See docs/API_CONTRACTS.md (GET /api/v1/contacts/requests).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncomingRequestDto {

    private String id;
    private ContactUserSummaryDto fromUser;
    private Instant createdAt;
}
