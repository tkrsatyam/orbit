package com.orbit.group.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Wrapper response for group member list")
public record GroupMemberListResponse(
        @Schema(description = "List of group members")
        List<GroupMemberResponse> content
) {}
