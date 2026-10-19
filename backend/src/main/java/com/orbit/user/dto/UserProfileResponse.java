package com.orbit.user.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.orbit.user.model.User;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Public profile payload returned on GET /api/v1/users/{userId}.
 * Does not expose sensitive fields like email.
 * When the requester is blocked by the target user, degrades asymmetrically to { id, available: false }.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "Public user profile or masked profile unavailable response")
public record UserProfileResponse(
        @Schema(description = "Unique user identifier", example = "64f1a2b3c4d5e6f7a8b9c0d1")
        String id,

        @Schema(description = "User display name", example = "Satyam", nullable = true)
        String displayName,

        @Schema(description = "User avatar image URL", example = "https://pub-xxx.r2.dev/avatars/user-id.jpg", nullable = true)
        String avatarUrl,

        @Schema(description = "User profile bio", example = "Career switcher from finance to tech", nullable = true)
        String bio,

        @Schema(description = "Relationship status from the requester's perspective", example = "CONNECTED", nullable = true)
        ConnectionStatus connectionStatus,

        @Schema(description = "Availability flag present only when profile is masked due to a block", example = "false", nullable = true)
        Boolean available) {

    public static UserProfileResponse of(User user, ConnectionStatus connectionStatus) {
        return new UserProfileResponse(
                user.getId(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getBio(),
                connectionStatus,
                null
        );
    }

    public static UserProfileResponse unavailable(String userId) {
        return new UserProfileResponse(
                userId,
                null,
                null,
                null,
                null,
                false
        );
    }
}
