package com.orbit.contact.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload for accepting or declining an incoming connection request.
 * See docs/API_CONTRACTS.md (PATCH /api/v1/contacts/requests/{requestId}).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RespondRequestDto {

    @NotNull(message = "Action is required and must be either ACCEPT or DECLINE")
    private RequestAction action;
}
