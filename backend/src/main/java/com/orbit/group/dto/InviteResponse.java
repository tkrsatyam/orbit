package com.orbit.group.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Private group invite link response")
public record InviteResponse(
        @Schema(description = "Full invite URL", example = "http://localhost:4200/invite/a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        String inviteLink,

        @Schema(description = "Timestamp when the invite expires (7 days after issuance)")
        Instant expiresAt
) {}
