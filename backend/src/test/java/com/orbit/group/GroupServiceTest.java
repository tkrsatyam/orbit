package com.orbit.group;

import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.ForbiddenException;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.conversation.ConversationService;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupServiceTest {

    @Mock
    private GroupRepository groupRepository;

    @Mock
    private ConversationService conversationService;

    @Mock
    private UserRepository userRepository;

    private OrbitProperties orbitProperties;
    private GroupService groupService;

    @BeforeEach
    void setUp() {
        orbitProperties = new OrbitProperties(
                new OrbitProperties.Jwt("test-secret-at-least-32-chars-long-xxx", 900000, 604800000),
                new OrbitProperties.Cors("http://localhost:4200"),
                new OrbitProperties.Cookie(true, "None")
        );
        groupService = new GroupService(groupRepository, conversationService, orbitProperties, userRepository);
    }

    @Test
    void createGroup_Success() {
        CreateGroupRequest request = new CreateGroupRequest(
                "Java Builders",
                "A community for Java enthusiasts",
                "java-spring",
                GroupVisibility.PUBLIC
        );

        when(groupRepository.existsByNameIgnoreCase("Java Builders")).thenReturn(false);
        when(groupRepository.save(any(Group.class))).thenAnswer(invocation -> {
            Group g = invocation.getArgument(0);
            if (g.getId() == null) {
                g.setId("group-123");
            }
            return g;
        });

        Conversation conv = Conversation.builder()
                .id("conv-456")
                .type(ConversationType.GROUP)
                .groupId("group-123")
                .participantIds(new ArrayList<>(List.of("user-admin")))
                .build();
        when(conversationService.createGroupConversation("user-admin", "group-123")).thenReturn(conv);

        GroupResponse response = groupService.createGroup("user-admin", request);

        assertThat(response.id()).isEqualTo("group-123");
        assertThat(response.name()).isEqualTo("Java Builders");
        assertThat(response.description()).isEqualTo("A community for Java enthusiasts");
        assertThat(response.topicTag()).isEqualTo("java-spring");
        assertThat(response.visibility()).isEqualTo(GroupVisibility.PUBLIC);
        assertThat(response.memberCount()).isEqualTo(1);
        assertThat(response.conversationId()).isEqualTo("conv-456");
        assertThat(response.role()).isEqualTo(GroupRole.ADMIN);

        verify(conversationService).createGroupConversation("user-admin", "group-123");
    }

    @Test
    void createGroup_DuplicateName_ThrowsConflictException() {
        CreateGroupRequest request = new CreateGroupRequest(
                "Existing Group",
                "Desc",
                "tag",
                GroupVisibility.PUBLIC
        );
        when(groupRepository.existsByNameIgnoreCase("Existing Group")).thenReturn(true);

        assertThatThrownBy(() -> groupService.createGroup("user-admin", request))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Group name is already taken");

        verify(groupRepository, never()).save(any(Group.class));
        verify(conversationService, never()).createGroupConversation(any(), any());
    }

    @Test
    void createGroup_NullCreator_ThrowsIllegalArgumentException() {
        CreateGroupRequest request = new CreateGroupRequest("Name", null, null, GroupVisibility.PUBLIC);

        assertThatThrownBy(() -> groupService.createGroup(null, request))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createInvite_AsAdmin_Success() {
        Group group = Group.builder()
                .id("group-1")
                .name("Private Space")
                .visibility(GroupVisibility.PRIVATE)
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId("user-admin").role(GroupRole.ADMIN).build(),
                        GroupMember.builder().userId("user-member").role(GroupRole.MEMBER).build()
                )))
                .build();
        when(groupRepository.findById("group-1")).thenReturn(Optional.of(group));
        when(groupRepository.save(any(Group.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InviteResponse response = groupService.createInvite("user-admin", "group-1");

        assertThat(response.inviteLink()).startsWith("http://localhost:4200/invite/");
        assertThat(response.expiresAt()).isAfter(Instant.now().plus(6, ChronoUnit.DAYS));
        assertThat(group.getInviteToken()).isNotNull();
    }

    @Test
    void createInvite_AsRegularMember_ThrowsForbiddenException() {
        Group group = Group.builder()
                .id("group-1")
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId("user-admin").role(GroupRole.ADMIN).build(),
                        GroupMember.builder().userId("user-member").role(GroupRole.MEMBER).build()
                )))
                .build();
        when(groupRepository.findById("group-1")).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> groupService.createInvite("user-member", "group-1"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only group admins can generate invite links");

        verify(groupRepository, never()).save(any());
    }

    @Test
    void createInvite_GroupNotFound_ThrowsResourceNotFoundException() {
        when(groupRepository.findById("missing-group")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> groupService.createInvite("user-admin", "missing-group"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Group not found");
    }

    @Test
    void joinViaInvite_Success() {
        Group group = Group.builder()
                .id("group-1")
                .name("Private Space")
                .conversationId("conv-1")
                .memberCount(1)
                .inviteToken("valid-token")
                .inviteTokenExpiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId("user-admin").role(GroupRole.ADMIN).build()
                )))
                .build();
        when(groupRepository.findByInviteToken("valid-token")).thenReturn(Optional.of(group));
        when(groupRepository.save(any(Group.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GroupJoinResponse response = groupService.joinViaInvite("user-joiner", "valid-token");

        assertThat(response.groupId()).isEqualTo("group-1");
        assertThat(response.conversationId()).isEqualTo("conv-1");
        assertThat(response.role()).isEqualTo(GroupRole.MEMBER);
        assertThat(group.getMemberCount()).isEqualTo(2);
        assertThat(group.getMembers()).hasSize(2);
        assertThat(group.getMembers().get(1).getUserId()).isEqualTo("user-joiner");
        assertThat(group.getMembers().get(1).getRole()).isEqualTo(GroupRole.MEMBER);

        verify(conversationService).addGroupParticipant("conv-1", "user-joiner");
    }

    @Test
    void joinViaInvite_ExpiredToken_ThrowsResourceNotFoundException() {
        Group group = Group.builder()
                .id("group-1")
                .inviteToken("expired-token")
                .inviteTokenExpiresAt(Instant.now().minus(1, ChronoUnit.DAYS))
                .build();
        when(groupRepository.findByInviteToken("expired-token")).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> groupService.joinViaInvite("user-joiner", "expired-token"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Invite link is invalid or has expired");
    }

    @Test
    void joinViaInvite_AlreadyMember_ThrowsConflictException() {
        Group group = Group.builder()
                .id("group-1")
                .inviteToken("valid-token")
                .inviteTokenExpiresAt(Instant.now().plus(2, ChronoUnit.DAYS))
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId("user-already-in").role(GroupRole.MEMBER).build()
                )))
                .build();
        when(groupRepository.findByInviteToken("valid-token")).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> groupService.joinViaInvite("user-already-in", "valid-token"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("User is already a member of this group");
    }

    @Test
    void getUserGroups_ReturnsUserGroupsWithRole() {
        Group g1 = Group.builder()
                .id("g1")
                .name("Group 1")
                .members(List.of(GroupMember.builder().userId("u1").role(GroupRole.ADMIN).build()))
                .build();
        Group g2 = Group.builder()
                .id("g2")
                .name("Group 2")
                .members(List.of(GroupMember.builder().userId("u1").role(GroupRole.MEMBER).build()))
                .build();
        when(groupRepository.findByMembersUserId("u1")).thenReturn(List.of(g1, g2));

        List<GroupResponse> result = groupService.getUserGroups("u1");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).role()).isEqualTo(GroupRole.ADMIN);
        assertThat(result.get(1).role()).isEqualTo(GroupRole.MEMBER);
    }

    @Test
    void getGroupDetails_PublicGroup_ReturnsDetailsForAnyUser() {
        Group publicGroup = Group.builder()
                .id("grp-pub")
                .name("Public Hub")
                .visibility(GroupVisibility.PUBLIC)
                .members(List.of(GroupMember.builder().userId("u-creator").role(GroupRole.ADMIN).build()))
                .build();
        when(groupRepository.findById("grp-pub")).thenReturn(Optional.of(publicGroup));

        GroupResponse response = groupService.getGroupDetails("u-other", "grp-pub");

        assertThat(response.id()).isEqualTo("grp-pub");
        assertThat(response.name()).isEqualTo("Public Hub");
        assertThat(response.role()).isNull();
    }

    @Test
    void getGroupDetails_PrivateGroup_Member_ReturnsDetails() {
        Group privateGroup = Group.builder()
                .id("grp-priv")
                .name("Private Hub")
                .visibility(GroupVisibility.PRIVATE)
                .members(List.of(GroupMember.builder().userId("u-member").role(GroupRole.MEMBER).build()))
                .build();
        when(groupRepository.findById("grp-priv")).thenReturn(Optional.of(privateGroup));

        GroupResponse response = groupService.getGroupDetails("u-member", "grp-priv");

        assertThat(response.id()).isEqualTo("grp-priv");
        assertThat(response.role()).isEqualTo(GroupRole.MEMBER);
    }

    @Test
    void getGroupDetails_PrivateGroup_NonMember_ThrowsResourceNotFound() {
        Group privateGroup = Group.builder()
                .id("grp-priv")
                .name("Private Hub")
                .visibility(GroupVisibility.PRIVATE)
                .members(List.of(GroupMember.builder().userId("u-member").role(GroupRole.MEMBER).build()))
                .build();
        when(groupRepository.findById("grp-priv")).thenReturn(Optional.of(privateGroup));

        assertThatThrownBy(() -> groupService.getGroupDetails("u-stranger", "grp-priv"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Group not found");
    }

    @Test
    void updateGroup_Admin_UpdatesFieldsSuccessfully() {
        Group group = Group.builder()
                .id("grp-1")
                .name("Original Name")
                .description("Old Desc")
                .topicTag("#old")
                .members(List.of(GroupMember.builder().userId("admin-1").role(GroupRole.ADMIN).build()))
                .build();
        when(groupRepository.findById("grp-1")).thenReturn(Optional.of(group));
        when(groupRepository.existsByNameIgnoreCaseAndIdNot("New Name", "grp-1")).thenReturn(false);
        when(groupRepository.save(any(Group.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateGroupRequest request = new UpdateGroupRequest("New Name", "New Description", "new-tag");
        GroupResponse response = groupService.updateGroup("admin-1", "grp-1", request);

        assertThat(response.name()).isEqualTo("New Name");
        assertThat(response.description()).isEqualTo("New Description");
        assertThat(response.topicTag()).isEqualTo("#new-tag");
    }

    @Test
    void updateGroup_NonAdmin_ThrowsForbidden() {
        Group group = Group.builder()
                .id("grp-1")
                .name("Original Name")
                .members(List.of(GroupMember.builder().userId("member-1").role(GroupRole.MEMBER).build()))
                .build();
        when(groupRepository.findById("grp-1")).thenReturn(Optional.of(group));

        UpdateGroupRequest request = new UpdateGroupRequest("New Name", null, null);

        assertThatThrownBy(() -> groupService.updateGroup("member-1", "grp-1", request))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only group admins can update group details");
    }

    @Test
    void updateGroup_DuplicateName_ThrowsConflict() {
        Group group = Group.builder()
                .id("grp-1")
                .name("Original Name")
                .members(List.of(GroupMember.builder().userId("admin-1").role(GroupRole.ADMIN).build()))
                .build();
        when(groupRepository.findById("grp-1")).thenReturn(Optional.of(group));
        when(groupRepository.existsByNameIgnoreCaseAndIdNot("Taken Name", "grp-1")).thenReturn(true);

        UpdateGroupRequest request = new UpdateGroupRequest("Taken Name", null, null);

        assertThatThrownBy(() -> groupService.updateGroup("admin-1", "grp-1", request))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Group name is already taken");
    }

    @Test
    void getGroupMembers_Member_ReturnsMemberListWithUserDetails() {
        Group group = Group.builder()
                .id("grp-1")
                .members(List.of(
                        GroupMember.builder().userId("u-1").role(GroupRole.ADMIN).joinedAt(Instant.now()).build(),
                        GroupMember.builder().userId("u-2").role(GroupRole.MEMBER).joinedAt(Instant.now()).build()
                ))
                .build();
        when(groupRepository.findById("grp-1")).thenReturn(Optional.of(group));

        User user1 = User.builder().id("u-1").displayName("Alice Admin").avatarUrl("http://avatar1").build();
        User user2 = User.builder().id("u-2").displayName("Bob Member").avatarUrl(null).build();
        when(userRepository.findAllById(List.of("u-1", "u-2"))).thenReturn(List.of(user1, user2));

        GroupMemberListResponse response = groupService.getGroupMembers("u-2", "grp-1");

        assertThat(response.content()).hasSize(2);
        assertThat(response.content().get(0).displayName()).isEqualTo("Alice Admin");
        assertThat(response.content().get(0).role()).isEqualTo(GroupRole.ADMIN);
        assertThat(response.content().get(1).displayName()).isEqualTo("Bob Member");
        assertThat(response.content().get(1).role()).isEqualTo(GroupRole.MEMBER);
    }

    @Test
    void getGroupMembers_NonMember_ThrowsForbidden() {
        Group group = Group.builder()
                .id("grp-1")
                .members(List.of(GroupMember.builder().userId("u-1").role(GroupRole.ADMIN).build()))
                .build();
        when(groupRepository.findById("grp-1")).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> groupService.getGroupMembers("u-outsider", "grp-1"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Must be a group member to view the member list");
    }

    @Test
    void updateMemberRole_AdminPromotesMemberToAdmin_Success() {
        GroupMember adminMember = GroupMember.builder().userId("admin-1").role(GroupRole.ADMIN).joinedAt(Instant.now()).build();
        GroupMember targetMember = GroupMember.builder().userId("user-2").role(GroupRole.MEMBER).joinedAt(Instant.now()).build();
        Group group = Group.builder()
                .id("grp-1")
                .members(new ArrayList<>(List.of(adminMember, targetMember)))
                .build();
        when(groupRepository.findById("grp-1")).thenReturn(Optional.of(group));
        when(userRepository.findById("user-2")).thenReturn(Optional.of(User.builder().id("user-2").displayName("User Two").build()));

        GroupMemberResponse response = groupService.updateMemberRole("admin-1", "grp-1", "user-2", new UpdateMemberRoleRequest(GroupRole.ADMIN));

        assertThat(response.role()).isEqualTo(GroupRole.ADMIN);
        assertThat(targetMember.getRole()).isEqualTo(GroupRole.ADMIN);
        verify(groupRepository).save(group);
    }

    @Test
    void updateMemberRole_AdminDemotesAdminToMember_WhenMultipleAdmins_Success() {
        GroupMember admin1 = GroupMember.builder().userId("admin-1").role(GroupRole.ADMIN).joinedAt(Instant.now()).build();
        GroupMember admin2 = GroupMember.builder().userId("admin-2").role(GroupRole.ADMIN).joinedAt(Instant.now()).build();
        Group group = Group.builder()
                .id("grp-1")
                .members(new ArrayList<>(List.of(admin1, admin2)))
                .build();
        when(groupRepository.findById("grp-1")).thenReturn(Optional.of(group));
        when(userRepository.findById("admin-2")).thenReturn(Optional.of(User.builder().id("admin-2").displayName("Admin Two").build()));

        GroupMemberResponse response = groupService.updateMemberRole("admin-1", "grp-1", "admin-2", new UpdateMemberRoleRequest(GroupRole.MEMBER));

        assertThat(response.role()).isEqualTo(GroupRole.MEMBER);
        assertThat(admin2.getRole()).isEqualTo(GroupRole.MEMBER);
        verify(groupRepository).save(group);
    }

    @Test
    void updateMemberRole_AdminDemotesSoleAdmin_ThrowsConflict() {
        GroupMember soleAdmin = GroupMember.builder().userId("admin-1").role(GroupRole.ADMIN).joinedAt(Instant.now()).build();
        GroupMember regular = GroupMember.builder().userId("user-2").role(GroupRole.MEMBER).joinedAt(Instant.now()).build();
        Group group = Group.builder()
                .id("grp-1")
                .members(new ArrayList<>(List.of(soleAdmin, regular)))
                .build();
        when(groupRepository.findById("grp-1")).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> groupService.updateMemberRole("admin-1", "grp-1", "admin-1", new UpdateMemberRoleRequest(GroupRole.MEMBER)))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Cannot demote the sole admin of the group");
    }

    @Test
    void updateMemberRole_NonAdminCaller_ThrowsForbidden() {
        GroupMember regular = GroupMember.builder().userId("user-1").role(GroupRole.MEMBER).build();
        Group group = Group.builder()
                .id("grp-1")
                .members(new ArrayList<>(List.of(regular)))
                .build();
        when(groupRepository.findById("grp-1")).thenReturn(Optional.of(group));

        assertThatThrownBy(() -> groupService.updateMemberRole("user-1", "grp-1", "user-1", new UpdateMemberRoleRequest(GroupRole.ADMIN)))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only group admins can manage member roles");
    }
}
