package com.orbit.group;

import com.orbit.common.dto.ErrorResponse;
import com.orbit.group.dto.CreateGroupRequest;
import com.orbit.group.dto.GroupJoinResponse;
import com.orbit.group.dto.GroupMemberListResponse;
import com.orbit.group.dto.GroupMemberResponse;
import com.orbit.group.dto.GroupPageResponse;
import com.orbit.group.dto.GroupResponse;
import com.orbit.group.dto.InviteResponse;
import com.orbit.group.dto.UpdateGroupRequest;
import com.orbit.group.dto.UpdateMemberRoleRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for group management, visibility, and invite access.
 * See docs/API_CONTRACTS.md (Group Endpoints).
 */
@Tag(name = "Groups", description = "Group CRUD, membership, roles, and invite links")
@RestController
@RequestMapping("/api/v1/groups")
@SecurityRequirement(name = "bearerAuth")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @Operation(summary = "Create a new group", description = "Creates a group and its associated group conversation. Creator becomes first Admin.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "201",
                    description = "Group created successfully",
                    content = @Content(schema = @Schema(implementation = GroupResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Validation failure",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "Group name already taken",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "429",
                    description = "Rate limit exceeded",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroupResponse createGroup(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @Valid @RequestBody CreateGroupRequest request) {
        String userId = resolveUserId(principalUserId, authentication);
        return groupService.createGroup(userId, request);
    }

    @Operation(summary = "Discover public groups", description = "Returns a paginated list of public groups with optional search and topic tag filters. Unauthenticated access allowed.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Paginated list of public groups",
                    content = @Content(schema = @Schema(implementation = GroupPageResponse.class))
            )
    })
    @GetMapping
    public GroupPageResponse discoverGroups(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String userId = resolveUserId(principalUserId, authentication);
        return groupService.discoverGroups(userId, q, tag, page, size);
    }

    @Operation(summary = "List current user's groups", description = "Returns all groups that the authenticated user is a member of.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "List of user's joined groups"
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @GetMapping("/mine")
    public List<GroupResponse> getMyGroups(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication) {
        String userId = resolveUserId(principalUserId, authentication);
        return groupService.getUserGroups(userId);
    }

    @Operation(summary = "Generate group invite link", description = "Generates a 7-day invite link for a private group. Admin-only.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "201",
                    description = "Invite link generated successfully",
                    content = @Content(schema = @Schema(implementation = InviteResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "User is not an admin of this group",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Group not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PostMapping("/{groupId}/invite")
    @ResponseStatus(HttpStatus.CREATED)
    public InviteResponse createInvite(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String groupId) {
        String userId = resolveUserId(principalUserId, authentication);
        return groupService.createInvite(userId, groupId);
    }

    @Operation(summary = "Join group via invite link", description = "Joins a private group using a valid, non-expired invite token.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Successfully joined the group",
                    content = @Content(schema = @Schema(implementation = GroupJoinResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Invite token not found or expired",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "User is already a member of this group",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PostMapping("/join-via-invite/{inviteToken}")
    public GroupJoinResponse joinViaInvite(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String inviteToken) {
        String userId = resolveUserId(principalUserId, authentication);
        return groupService.joinViaInvite(userId, inviteToken);
    }

    @Operation(summary = "Join public group", description = "One-step join for a public group without needing an invite token.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Successfully joined the group",
                    content = @Content(schema = @Schema(implementation = GroupJoinResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "Group is private and requires an invite link",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Group not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "User is already a member of this group",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PostMapping("/{groupId}/join")
    public GroupJoinResponse joinPublicGroup(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String groupId) {
        String userId = resolveUserId(principalUserId, authentication);
        return groupService.joinPublicGroup(userId, groupId);
    }

    @Operation(summary = "Get group details", description = "Retrieves group details. Public groups are visible to all users, private groups are member-only.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Group details retrieved successfully",
                    content = @Content(schema = @Schema(implementation = GroupResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Group not found or private",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @GetMapping("/{groupId}")
    public GroupResponse getGroupDetails(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String groupId) {
        String userId = resolveUserId(principalUserId, authentication);
        return groupService.getGroupDetails(userId, groupId);
    }

    @Operation(summary = "Update group details", description = "Updates group metadata. Admin-only operation.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Group updated successfully",
                    content = @Content(schema = @Schema(implementation = GroupResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Validation failure",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "Only group admins can update group details",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Group not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "Group name already taken",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PatchMapping("/{groupId}")
    public GroupResponse updateGroup(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String groupId,
            @Valid @RequestBody UpdateGroupRequest request) {
        String userId = resolveUserId(principalUserId, authentication);
        return groupService.updateGroup(userId, groupId, request);
    }

    @Operation(summary = "Get group member list", description = "Retrieves all members of a group with their roles. Caller must be a member.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Member list retrieved successfully",
                    content = @Content(schema = @Schema(implementation = GroupMemberListResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "Caller is not a member of the group",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Group not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @GetMapping("/{groupId}/members")
    public GroupMemberListResponse getGroupMembers(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String groupId) {
        String userId = resolveUserId(principalUserId, authentication);
        return groupService.getGroupMembers(userId, groupId);
    }

    @Operation(summary = "Update member role", description = "Promote or demote a group member. Admin-only operation. Cannot demote sole admin.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Member role updated successfully",
                    content = @Content(schema = @Schema(implementation = GroupMemberResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Validation failure",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "Caller is not an admin",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Group or member not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "Cannot demote the sole admin",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PatchMapping("/{groupId}/members/{targetUserId}/role")
    public GroupMemberResponse updateMemberRole(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String groupId,
            @PathVariable String targetUserId,
            @Valid @RequestBody UpdateMemberRoleRequest request) {
        String userId = resolveUserId(principalUserId, authentication);
        return groupService.updateMemberRole(userId, groupId, targetUserId, request);
    }

    @Operation(summary = "Leave a group", description = "Leaves a group. If last member, tears down group. If sole admin, promotes oldest member.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "204",
                    description = "Successfully left the group"
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "Caller is not a member of the group",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Group not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PostMapping("/{groupId}/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leaveGroup(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String groupId) {
        String userId = resolveUserId(principalUserId, authentication);
        groupService.leaveGroup(userId, groupId);
    }

    @Operation(summary = "Remove member from group", description = "Evicts a member from the group. Admin-only operation. Cannot remove another admin or self.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "204",
                    description = "Member removed successfully"
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Cannot remove self via remove member endpoint",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "Caller is not an admin or target is an admin",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Group or member not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @DeleteMapping("/{groupId}/members/{targetUserId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String groupId,
            @PathVariable String targetUserId) {
        String userId = resolveUserId(principalUserId, authentication);
        groupService.removeMember(userId, groupId, targetUserId);
    }

    @Operation(summary = "Delete group", description = "Permanently deletes the group and cascades to its conversation. Admin-only operation.")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "204",
                    description = "Group deleted successfully"
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing or invalid bearer token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "Caller is not an admin",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Group not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @DeleteMapping("/{groupId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGroup(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String groupId) {
        String userId = resolveUserId(principalUserId, authentication);
        groupService.deleteGroup(userId, groupId);
    }

    private String resolveUserId(String principalUserId, Authentication authentication) {
        if (principalUserId != null && !principalUserId.isBlank()) {
            return principalUserId;
        }
        if (authentication != null && authentication.getName() != null) {
            return authentication.getName();
        }
        return null;
    }
}
