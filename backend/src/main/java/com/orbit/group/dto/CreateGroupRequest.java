package com.orbit.group.dto;

import com.orbit.group.model.GroupVisibility;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(description = "Payload for creating a new group")
public record CreateGroupRequest(
        @Schema(description = "Unique group name", example = "FAANG Interview Prep")
        @NotBlank(message = "Group name is required")
        @Size(min = 3, max = 100, message = "Group name must be between 3 and 100 characters")
        String name,

        @Schema(description = "Optional description", example = "Weekly mock interviews and distributed system design")
        @Size(max = 500, message = "Description must be at most 500 characters")
        String description,

        @Schema(description = "Topic tag for categorization", example = "interview-prep")
        @Size(max = 50, message = "Topic tag must be at most 50 characters")
        String topicTag,

        @Schema(description = "Visibility determining join mechanism", example = "PUBLIC")
        @NotNull(message = "Visibility is required")
        GroupVisibility visibility
) {}
