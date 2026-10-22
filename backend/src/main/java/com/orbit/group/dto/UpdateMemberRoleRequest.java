package com.orbit.group.dto;

import com.orbit.group.model.GroupRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Request to update member role in group")
public record UpdateMemberRoleRequest(
        @Schema(description = "New role: ADMIN or MEMBER", example = "ADMIN")
        @NotNull(message = "Role is required")
        GroupRole role
) {}
