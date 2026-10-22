package com.orbit.group.dto;

import com.orbit.group.model.GroupRole;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Response returned upon joining a group")
public record GroupJoinResponse(
        @Schema(description = "Group ID", example = "64f1a2b3c4d5e6f7a8b9c0e2")
        String groupId,

        @Schema(description = "Conversation ID for messaging", example = "64f1a2b3c4d5e6f7a8b9c0e1")
        String conversationId,

        @Schema(description = "Role assigned to new member", example = "MEMBER")
        GroupRole role
) {}
