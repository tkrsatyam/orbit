package com.orbit.group.dto;

import com.orbit.group.model.GroupRole;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "Details of a group member")
public record GroupMemberResponse(
        @Schema(description = "User ID", example = "64f1a2b3c4d5e6f7a8b9c0d1")
        String userId,

        @Schema(description = "User display name", example = "Satyam Kumar")
        String displayName,

        @Schema(description = "User avatar URL", example = "https://pub-xxx.r2.dev/avatars/u1.jpg")
        String avatarUrl,

        @Schema(description = "Role in group", example = "ADMIN")
        GroupRole role,

        @Schema(description = "Whether user is online", example = "true")
        boolean online,

        @Schema(description = "Timestamp when user joined group", example = "2026-06-27T10:30:00Z")
        Instant joinedAt
) {}
