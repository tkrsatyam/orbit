package com.orbit.group.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Paginated envelope for public group discovery listings.
 * See docs/API_CONTRACTS.md (GET /api/v1/groups).
 */
@Schema(description = "Paginated public group discovery response")
public record GroupPageResponse(
        @Schema(description = "List of public groups")
        List<GroupResponse> content,

        @Schema(description = "Current page index (0-based)", example = "0")
        int page,

        @Schema(description = "Page size", example = "20")
        int size,

        @Schema(description = "Total number of matching public groups", example = "42")
        long totalElements,

        @Schema(description = "Total number of pages", example = "3")
        int totalPages,

        @Schema(description = "Whether this is the last page", example = "false")
        boolean last
) {}
