package com.orbit.contact.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request payload for sending an outbound connection request.
 * See docs/API_CONTRACTS.md (POST /api/v1/contacts/requests).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendRequestDto {

    @NotBlank(message = "targetUserId is required")
    private String targetUserId;
}
