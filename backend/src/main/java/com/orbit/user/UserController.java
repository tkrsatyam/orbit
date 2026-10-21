package com.orbit.user;

import com.orbit.common.dto.ErrorResponse;
import com.orbit.user.dto.SelfProfileResponse;
import com.orbit.user.dto.SuggestedUserResponse;
import com.orbit.user.dto.UserProfileResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "User", description = "User profile management")
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "Get current user profile", description = "Returns the authenticated user's own profile including email")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Profile retrieved successfully",
                    content = @Content(schema = @Schema(implementation = SelfProfileResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing, invalid, expired, or blacklisted access token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "User account not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "429",
                    description = "Rate limit exceeded",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @GetMapping("/me")
    public ResponseEntity<SelfProfileResponse> getSelfProfile(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication) {

        String userId = principalUserId != null ? principalUserId : (authentication != null ? authentication.getName() : null);
        SelfProfileResponse profile = userService.getSelfProfile(userId);
        return ResponseEntity.ok(profile);
    }

    @Operation(summary = "Get suggested users to connect with", description = "Returns active users excluding the requester and existing contacts/blocks")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Suggested users retrieved successfully"
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing, invalid, expired, or blacklisted access token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @GetMapping("/suggested")
    public ResponseEntity<List<SuggestedUserResponse>> getSuggestedUsers(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication) {

        String userId = principalUserId != null ? principalUserId : (authentication != null ? authentication.getName() : null);
        List<SuggestedUserResponse> suggested = userService.getSuggestedUsers(userId);
        return ResponseEntity.ok(suggested);
    }

    @Operation(summary = "Get user profile by ID", description = "Returns public profile of a user, or degraded available=false if blocked")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Profile retrieved successfully (normal or degraded)",
                    content = @Content(schema = @Schema(implementation = UserProfileResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing, invalid, expired, or blacklisted access token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Target user account not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "429",
                    description = "Rate limit exceeded",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileResponse> getUserProfile(
            @PathVariable("userId") String targetUserId,
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication) {

        String requesterId = principalUserId != null ? principalUserId : (authentication != null ? authentication.getName() : null);
        UserProfileResponse profile = userService.getUserProfile(targetUserId, requesterId);
        return ResponseEntity.ok(profile);
    }
}
