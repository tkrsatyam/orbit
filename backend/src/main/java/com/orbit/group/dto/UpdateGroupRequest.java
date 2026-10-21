package com.orbit.group.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

@Schema(description = "Request payload for updating group metadata (all fields optional)")
public record UpdateGroupRequest(
        @Schema(description = "Updated group name", example = "FAANG Interview Prep 2026")
        @Size(min = 3, max = 100, message = "Group name must be between 3 and 100 characters")
        String name,

        @Schema(description = "Updated group description", example = "Updated description")
        @Size(max = 500, message = "Description must not exceed 500 characters")
        String description,

        @Schema(description = "Updated topic tag", example = "#interview-prep")
        @Size(max = 50, message = "Topic tag must not exceed 50 characters")
        String topicTag
) {}
