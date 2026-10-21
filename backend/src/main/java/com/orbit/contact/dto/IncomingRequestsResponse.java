package com.orbit.contact.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Envelope containing the list of pending incoming connection requests.
 * See docs/API_CONTRACTS.md (GET /api/v1/contacts/requests).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncomingRequestsResponse {

    @Builder.Default
    private List<IncomingRequestDto> content = new ArrayList<>();
}
