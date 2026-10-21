package com.orbit.user.dto;

import com.orbit.user.model.User;

public record SuggestedUserResponse(
        String id,
        String displayName,
        String bio,
        String avatarUrl,
        String initials
) {
    public static SuggestedUserResponse from(User user) {
        String initials = "U";
        if (user.getDisplayName() != null && !user.getDisplayName().isBlank()) {
            String[] parts = user.getDisplayName().trim().split("\\s+");
            if (parts.length >= 2) {
                initials = (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
            } else {
                initials = parts[0].substring(0, Math.min(2, parts[0].length())).toUpperCase();
            }
        }
        return new SuggestedUserResponse(
                user.getId(),
                user.getDisplayName(),
                user.getBio() != null ? user.getBio() : "Orbit community member",
                user.getAvatarUrl(),
                initials
        );
    }
}
