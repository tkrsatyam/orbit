package com.orbit.group;

import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.ForbiddenException;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.conversation.ConversationService;
import com.orbit.conversation.model.Conversation;
import com.orbit.group.dto.CreateGroupRequest;
import com.orbit.group.dto.GroupJoinResponse;
import com.orbit.group.dto.GroupMemberListResponse;
import com.orbit.group.dto.GroupMemberResponse;
import com.orbit.group.dto.GroupResponse;
import com.orbit.group.dto.InviteResponse;
import com.orbit.group.dto.UpdateGroupRequest;
import com.orbit.group.dto.UpdateMemberRoleRequest;
import com.orbit.group.model.Group;
import com.orbit.group.model.GroupMember;
import com.orbit.group.model.GroupRole;
import com.orbit.group.model.GroupVisibility;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Service managing group creation, visibility, invite link generation, and memberships.
 * See docs/BACKEND_STRUCTURE.md and docs/REQUIREMENTS.md (P1-21, P1-22, P1-23).
 */
@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final ConversationService conversationService;
    private final OrbitProperties orbitProperties;
    private final UserRepository userRepository;

    public GroupService(GroupRepository groupRepository,
                        ConversationService conversationService,
                        OrbitProperties orbitProperties,
                        UserRepository userRepository) {
        this.groupRepository = groupRepository;
        this.conversationService = conversationService;
        this.orbitProperties = orbitProperties;
        this.userRepository = userRepository;
    }

    /**
     * Creates a new group and its associated group conversation atomically.
     * The creator automatically becomes the first Admin.
     *
     * @param creatorId Authenticated user ID of the creator
     * @param request Validated group creation payload
     * @return GroupResponse representing the newly created group
     */
    public GroupResponse createGroup(String creatorId, CreateGroupRequest request) {
        if (creatorId == null || creatorId.isBlank()) {
            throw new IllegalArgumentException("Creator ID is required");
        }

        String normalizedName = request.name().trim();
        if (groupRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new ConflictException("Group name is already taken");
        }

        String topicTag = request.topicTag() != null && !request.topicTag().isBlank()
                ? request.topicTag().trim()
                : null;

        String description = request.description() != null && !request.description().isBlank()
                ? request.description().trim()
                : null;

        Group group = Group.builder()
                .name(normalizedName)
                .description(description)
                .topicTag(topicTag)
                .visibility(request.visibility())
                .members(new ArrayList<>(List.of(
                        GroupMember.builder()
                                .userId(creatorId)
                                .role(GroupRole.ADMIN)
                                .joinedAt(Instant.now())
                                .build()
                )))
                .memberCount(1)
                .build();

        Group savedGroup = groupRepository.save(group);

        Conversation conversation = conversationService.createGroupConversation(creatorId, savedGroup.getId());
        savedGroup.setConversationId(conversation.getId());
        savedGroup = groupRepository.save(savedGroup);

        return GroupResponse.from(savedGroup, GroupRole.ADMIN);
    }

    /**
     * Generates a 7-day invite link for a group. Only Admins can generate invites.
     * Regenerating immediately invalidates any previously generated token.
     *
     * @param adminUserId Authenticated user ID
     * @param groupId Target group ID
     * @return InviteResponse with the invite link and expiration timestamp
     */
    public InviteResponse createInvite(String adminUserId, String groupId) {
        if (adminUserId == null || adminUserId.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }

        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        boolean isAdmin = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(adminUserId) && m.getRole() == GroupRole.ADMIN);

        if (!isAdmin) {
            throw new ForbiddenException("Only group admins can generate invite links");
        }

        String inviteToken = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);

        group.setInviteToken(inviteToken);
        group.setInviteTokenExpiresAt(expiresAt);
        groupRepository.save(group);

        String frontendBaseUrl = orbitProperties.cors().allowedOrigin();
        String inviteLink = frontendBaseUrl.replaceAll("/+$", "") + "/invite/" + inviteToken;

        return new InviteResponse(inviteLink, expiresAt);
    }

    /**
     * Joins a group using a valid, non-expired invite token.
     *
     * @param userId Authenticated joining user ID
     * @param inviteToken Secret token from the invite URL
     * @return GroupJoinResponse with groupId and conversationId
     */
    public GroupJoinResponse joinViaInvite(String userId, String inviteToken) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }
        if (inviteToken == null || inviteToken.isBlank()) {
            throw new IllegalArgumentException("Invite token is required");
        }

        Group group = groupRepository.findByInviteToken(inviteToken)
                .orElseThrow(() -> new ResourceNotFoundException("Invite link is invalid or has expired"));

        if (group.getInviteTokenExpiresAt() == null || group.getInviteTokenExpiresAt().isBefore(Instant.now())) {
            throw new ResourceNotFoundException("Invite link is invalid or has expired");
        }

        boolean alreadyMember = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(userId));

        if (alreadyMember) {
            throw new ConflictException("User is already a member of this group");
        }

        group.getMembers().add(GroupMember.builder()
                .userId(userId)
                .role(GroupRole.MEMBER)
                .joinedAt(Instant.now())
                .build());
        group.setMemberCount(group.getMemberCount() + 1);
        groupRepository.save(group);

        conversationService.addGroupParticipant(group.getConversationId(), userId);

        return new GroupJoinResponse(group.getId(), group.getConversationId(), GroupRole.MEMBER);
    }

    /**
     * Retrieves all groups that the specified user has joined.
     *
     * @param userId Authenticated user ID
     * @return List of GroupResponse objects
     */
    public List<GroupResponse> getUserGroups(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }

        return groupRepository.findByMembersUserId(userId).stream()
                .map(group -> {
                    GroupRole callerRole = group.getMembers().stream()
                            .filter(m -> m.getUserId().equals(userId))
                            .findFirst()
                            .map(GroupMember::getRole)
                            .orElse(GroupRole.MEMBER);
                    return GroupResponse.from(group, callerRole);
                })
                .toList();
    }

    /**
     * Retrieves group details. Public groups are visible to all authenticated users.
     * Private groups are visible to members only; returns 404 if user is not a member.
     *
     * @param userId Authenticated user ID
     * @param groupId Group ID
     * @return GroupResponse representing the group
     */
    public GroupResponse getGroupDetails(String userId, String groupId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        GroupMember callerMember = group.getMembers().stream()
                .filter(m -> m.getUserId().equals(userId))
                .findFirst()
                .orElse(null);

        if (group.getVisibility() == GroupVisibility.PRIVATE && callerMember == null) {
            throw new ResourceNotFoundException("Group not found");
        }

        GroupRole callerRole = callerMember != null ? callerMember.getRole() : null;
        return GroupResponse.from(group, callerRole);
    }

    /**
     * Updates group metadata. Admin-only operation.
     *
     * @param userId Authenticated user ID (must be an Admin)
     * @param groupId Target group ID
     * @param request Update fields (name, description, topicTag)
     * @return Updated GroupResponse
     */
    public GroupResponse updateGroup(String userId, String groupId, UpdateGroupRequest request) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        boolean isAdmin = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(userId) && m.getRole() == GroupRole.ADMIN);

        if (!isAdmin) {
            throw new ForbiddenException("Only group admins can update group details");
        }

        if (request.name() != null && !request.name().isBlank()) {
            String normalizedName = request.name().trim();
            if (groupRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, groupId)) {
                throw new ConflictException("Group name is already taken");
            }
            group.setName(normalizedName);
        }

        if (request.description() != null) {
            group.setDescription(request.description().trim().isEmpty() ? null : request.description().trim());
        }

        if (request.topicTag() != null) {
            String topic = request.topicTag().trim();
            if (!topic.isEmpty() && !topic.startsWith("#")) {
                topic = "#" + topic;
            }
            group.setTopicTag(topic.isEmpty() ? null : topic);
        }

        group.setUpdatedAt(Instant.now());
        Group savedGroup = groupRepository.save(group);

        return GroupResponse.from(savedGroup, GroupRole.ADMIN);
    }

    /**
     * Retrieves the member list for a group. Only members can view the member list.
     *
     * @param callerUserId Authenticated user ID
     * @param groupId Target group ID
     * @return GroupMemberListResponse containing all group members with user details and roles
     */
    public GroupMemberListResponse getGroupMembers(String callerUserId, String groupId) {
        if (callerUserId == null || callerUserId.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        boolean isMember = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(callerUserId));

        if (!isMember) {
            throw new ForbiddenException("Must be a group member to view the member list");
        }

        List<String> userIds = group.getMembers().stream()
                .map(GroupMember::getUserId)
                .toList();

        Map<String, User> userMap = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));

        List<GroupMemberResponse> members = group.getMembers().stream()
                .map(m -> {
                    User u = userMap.get(m.getUserId());
                    String displayName = u != null ? u.getDisplayName() : "Unknown User";
                    String avatarUrl = u != null ? u.getAvatarUrl() : null;
                    return new GroupMemberResponse(
                            m.getUserId(),
                            displayName,
                            avatarUrl,
                            m.getRole(),
                            false,
                            m.getJoinedAt()
                    );
                })
                .toList();

        return new GroupMemberListResponse(members);
    }

    /**
     * Promotes or demotes a group member. Admin-only operation.
     * Protection: Cannot demote the sole remaining admin of a group.
     *
     * @param adminUserId Authenticated user ID (must be group admin)
     * @param groupId Target group ID
     * @param targetUserId ID of the member whose role is being changed
     * @param request UpdateMemberRoleRequest containing the new role
     * @return Updated GroupMemberResponse
     */
    public GroupMemberResponse updateMemberRole(String adminUserId,
                                                String groupId,
                                                String targetUserId,
                                                UpdateMemberRoleRequest request) {
        if (adminUserId == null || adminUserId.isBlank()) {
            throw new IllegalArgumentException("Admin user ID is required");
        }
        if (targetUserId == null || targetUserId.isBlank()) {
            throw new IllegalArgumentException("Target user ID is required");
        }

        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        boolean isAdmin = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(adminUserId) && m.getRole() == GroupRole.ADMIN);

        if (!isAdmin) {
            throw new ForbiddenException("Only group admins can manage member roles");
        }

        GroupMember targetMember = group.getMembers().stream()
                .filter(m -> m.getUserId().equals(targetUserId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Member not found in group"));

        // Sole admin protection: cannot demote sole admin to member
        if (request.role() == GroupRole.MEMBER && targetMember.getRole() == GroupRole.ADMIN) {
            long adminCount = group.getMembers().stream()
                    .filter(m -> m.getRole() == GroupRole.ADMIN)
                    .count();
            if (adminCount <= 1) {
                throw new ConflictException("Cannot demote the sole admin of the group");
            }
        }

        targetMember.setRole(request.role());
        groupRepository.save(group);

        User targetUser = userRepository.findById(targetUserId).orElse(null);
        String displayName = targetUser != null ? targetUser.getDisplayName() : "Unknown User";
        String avatarUrl = targetUser != null ? targetUser.getAvatarUrl() : null;

        return new GroupMemberResponse(
                targetMember.getUserId(),
                displayName,
                avatarUrl,
                targetMember.getRole(),
                false,
                targetMember.getJoinedAt()
        );
    }
}
