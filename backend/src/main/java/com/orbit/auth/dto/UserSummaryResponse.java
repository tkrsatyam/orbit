package com.orbit.auth.dto;

import com.orbit.user.model.User;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * Summary of user profile returned upon authentication.
 */
@Schema(description = "User profile summary")
public record UserSummaryResponse(
        @Schema(description = "Unique user identifier", example = "64f1a2b3c4d5e6f7a8b9c0d1")
        String id,

        @Schema(description = "User email address", example = "satyam@example.com")
        String email,

        @Schema(description = "User display name", example = "Satyam")
        String displayName,

        @Schema(description = "User avatar image URL", example = "https://pub-xxx.r2.dev/avatars/user-id.jpg", nullable = true)
        String avatarUrl,

        @Schema(description = "User profile bio", example = "Career switcher from finance to tech", nullable = true)
        String bio,

        @Schema(description = "ISO-8601 UTC timestamp of account creation", example = "2026-06-27T10:30:00Z")
        Instant createdAt) {

    public static UserSummaryResponse from(User user) {
        return new UserSummaryResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getBio(),
                user.getCreatedAt()
        );
    }
}
