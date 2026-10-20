package com.orbit.contact.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight user representation embedded within contact and request responses.
 * See docs/API_CONTRACTS.md (POST /api/v1/contacts/requests).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ContactUserSummaryDto {

    private String id;
    private String displayName;
    private String avatarUrl;

    public ContactUserSummaryDto(String id, String displayName) {
        this.id = id;
        this.displayName = displayName;
    }
}
