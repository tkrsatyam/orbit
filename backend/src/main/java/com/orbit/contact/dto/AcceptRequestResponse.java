package com.orbit.contact.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response payload returned upon successfully accepting a connection request.
 * See docs/API_CONTRACTS.md (PATCH /api/v1/contacts/requests/{requestId}).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AcceptRequestResponse {

    @Builder.Default
    private String status = "ACCEPTED";

    private String conversationId;
}
