package com.orbit.group.dto;

import com.orbit.group.model.Group;
import com.orbit.group.model.GroupRole;
import com.orbit.group.model.GroupVisibility;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Group details response")
public record GroupResponse(
        @Schema(description = "Group ID", example = "64f1a2b3c4d5e6f7a8b9c0e2")
        String id,

        @Schema(description = "Group name", example = "FAANG Interview Prep")
        String name,

        @Schema(description = "Group description", example = "Weekly mock interviews and distributed system design")
        String description,

        @Schema(description = "Topic tag", example = "interview-prep")
        String topicTag,

        @Schema(description = "Group visibility", example = "PUBLIC")
        GroupVisibility visibility,

        @Schema(description = "Group avatar URL", example = "https://pub-xxx.r2.dev/groups/avatar.jpg")
        String avatarUrl,

        @Schema(description = "Group cover image URL", example = "https://pub-xxx.r2.dev/groups/cover.jpg")
        String coverImageUrl,

        @Schema(description = "Number of active members", example = "1")
        int memberCount,

        @Schema(description = "Associated conversation ID", example = "64f1a2b3c4d5e6f7a8b9c0e1")
        String conversationId,

        @Schema(description = "Timestamp of creation")
        Instant createdAt,

        @Schema(description = "Caller's role within the group", example = "ADMIN")
        GroupRole role
) {
    public static GroupResponse from(Group group, GroupRole callerRole) {
        return new GroupResponse(
                group.getId(),
                group.getName(),
                group.getDescription(),
                group.getTopicTag(),
                group.getVisibility(),
                group.getAvatarUrl(),
                group.getCoverImageUrl(),
                group.getMemberCount(),
                group.getConversationId(),
                group.getCreatedAt(),
                callerRole
        );
    }
}
