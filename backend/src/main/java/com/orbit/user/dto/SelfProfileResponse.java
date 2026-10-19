package com.orbit.user.dto;

import com.orbit.user.model.User;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * Full profile payload returned to the authenticated user on GET /api/v1/users/me.
 * Contains private account metadata including email.
 */
@Schema(description = "Authenticated user's own profile")
public record SelfProfileResponse(
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

    public static SelfProfileResponse from(User user) {
        return new SelfProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getBio(),
                user.getCreatedAt()
        );
    }
}
