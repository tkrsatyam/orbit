package com.orbit.group;

import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.ForbiddenException;
import com.orbit.common.exception.GlobalExceptionHandler;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.group.dto.CreateGroupRequest;
import com.orbit.group.dto.GroupJoinResponse;
import com.orbit.group.dto.GroupMemberListResponse;
import com.orbit.group.dto.GroupMemberResponse;
import com.orbit.group.dto.GroupPageResponse;
import com.orbit.group.dto.GroupResponse;
import com.orbit.group.dto.InviteResponse;
import com.orbit.group.dto.UpdateGroupRequest;
import com.orbit.group.dto.UpdateMemberRoleRequest;
import com.orbit.group.model.GroupRole;
import com.orbit.group.model.GroupVisibility;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class GroupControllerTest {

    @Mock
    private GroupService groupService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        GroupController controller = new GroupController(groupService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void createGroup_ValidPayload_Returns201() throws Exception {
        GroupResponse response = new GroupResponse(
                "group-1",
                "Java Builders",
                "Group description",
                "java-spring",
                GroupVisibility.PUBLIC,
                null,
                null,
                1,
                "conv-1",
                Instant.now(),
                GroupRole.ADMIN
        );
        when(groupService.createGroup(eq("user-1"), any(CreateGroupRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/groups")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Java Builders",
                                  "description": "Group description",
                                  "topicTag": "java-spring",
                                  "visibility": "PUBLIC"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("group-1"))
                .andExpect(jsonPath("$.name").value("Java Builders"))
                .andExpect(jsonPath("$.visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void createGroup_InvalidPayload_Returns400() throws Exception {
        mockMvc.perform(post("/api/v1/groups")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "ab",
                                  "visibility": "PUBLIC"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Bad Request"));
    }

    @Test
    void createGroup_DuplicateName_Returns409() throws Exception {
        when(groupService.createGroup(eq("user-1"), any(CreateGroupRequest.class)))
                .thenThrow(new ConflictException("Group name is already taken"));

        mockMvc.perform(post("/api/v1/groups")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Existing Group",
                                  "visibility": "PUBLIC"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Group name is already taken"));
    }

    @Test
    void getMyGroups_Returns200() throws Exception {
        GroupResponse response = new GroupResponse(
                "group-1",
                "Java Builders",
                null,
                null,
                GroupVisibility.PUBLIC,
                null,
                null,
                1,
                "conv-1",
                Instant.now(),
                GroupRole.ADMIN
        );
        when(groupService.getUserGroups("user-1")).thenReturn(List.of(response));

        mockMvc.perform(get("/api/v1/groups/mine")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("group-1"))
                .andExpect(jsonPath("$[0].name").value("Java Builders"));
    }

    @Test
    void createInvite_Returns201() throws Exception {
        InviteResponse response = new InviteResponse(
                "http://localhost:4200/invite/token-123",
                Instant.now().plusSeconds(604800)
        );
        when(groupService.createInvite("user-admin", "group-1")).thenReturn(response);

        mockMvc.perform(post("/api/v1/groups/group-1/invite")
                        .principal(new UsernamePasswordAuthenticationToken("user-admin", null, List.of())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.inviteLink").value("http://localhost:4200/invite/token-123"));
    }

    @Test
    void createInvite_NonAdmin_Returns403() throws Exception {
        when(groupService.createInvite("user-member", "group-1"))
                .thenThrow(new ForbiddenException("Only group admins can generate invite links"));

        mockMvc.perform(post("/api/v1/groups/group-1/invite")
                        .principal(new UsernamePasswordAuthenticationToken("user-member", null, List.of())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only group admins can generate invite links"));
    }

    @Test
    void joinViaInvite_Returns200() throws Exception {
        GroupJoinResponse response = new GroupJoinResponse("group-1", "conv-1", GroupRole.MEMBER);
        when(groupService.joinViaInvite("user-joiner", "token-123")).thenReturn(response);

        mockMvc.perform(post("/api/v1/groups/join-via-invite/token-123")
                        .principal(new UsernamePasswordAuthenticationToken("user-joiner", null, List.of())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupId").value("group-1"))
                .andExpect(jsonPath("$.conversationId").value("conv-1"))
                .andExpect(jsonPath("$.role").value("MEMBER"));
    }

    @Test
    void joinViaInvite_Expired_Returns404() throws Exception {
        when(groupService.joinViaInvite("user-joiner", "expired-token"))
                .thenThrow(new ResourceNotFoundException("Invite link is invalid or has expired"));

        mockMvc.perform(post("/api/v1/groups/join-via-invite/expired-token")
                        .principal(new UsernamePasswordAuthenticationToken("user-joiner", null, List.of())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Invite link is invalid or has expired"));
    }

    @Test
    void joinViaInvite_AlreadyMember_Returns409() throws Exception {
        when(groupService.joinViaInvite("user-member", "valid-token"))
                .thenThrow(new ConflictException("User is already a member of this group"));

        mockMvc.perform(post("/api/v1/groups/join-via-invite/valid-token")
                        .principal(new UsernamePasswordAuthenticationToken("user-member", null, List.of())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("User is already a member of this group"));
    }

    @Test
    void getGroupDetails_Success_Returns200() throws Exception {
        GroupResponse response = new GroupResponse(
                "group-1",
                "FAANG Prep",
                "Interview group",
                "interview",
                GroupVisibility.PUBLIC,
                null,
                null,
                10,
                "conv-1",
                Instant.now(),
                GroupRole.MEMBER
        );
        when(groupService.getGroupDetails("user-1", "group-1")).thenReturn(response);

        mockMvc.perform(get("/api/v1/groups/group-1")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("group-1"))
                .andExpect(jsonPath("$.name").value("FAANG Prep"))
                .andExpect(jsonPath("$.role").value("MEMBER"));
    }

    @Test
    void getGroupDetails_NotFoundOrPrivate_Returns404() throws Exception {
        when(groupService.getGroupDetails("user-1", "group-1"))
                .thenThrow(new ResourceNotFoundException("Group not found"));

        mockMvc.perform(get("/api/v1/groups/group-1")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Group not found"));
    }

    @Test
    void updateGroup_Success_Returns200() throws Exception {
        GroupResponse response = new GroupResponse(
                "group-1",
                "Updated Name",
                "Updated Desc",
                "#updated",
                GroupVisibility.PUBLIC,
                null,
                null,
                5,
                "conv-1",
                Instant.now(),
                GroupRole.ADMIN
        );
        when(groupService.updateGroup(eq("admin-1"), eq("group-1"), any(UpdateGroupRequest.class))).thenReturn(response);

        mockMvc.perform(patch("/api/v1/groups/group-1")
                        .principal(new UsernamePasswordAuthenticationToken("admin-1", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Updated Name",
                                  "description": "Updated Desc",
                                  "topicTag": "#updated"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Name"))
                .andExpect(jsonPath("$.topicTag").value("#updated"));
    }

    @Test
    void updateGroup_NonAdmin_Returns403() throws Exception {
        when(groupService.updateGroup(eq("member-1"), eq("group-1"), any(UpdateGroupRequest.class)))
                .thenThrow(new ForbiddenException("Only group admins can update group details"));

        mockMvc.perform(patch("/api/v1/groups/group-1")
                        .principal(new UsernamePasswordAuthenticationToken("member-1", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Updated Name"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only group admins can update group details"));
    }

    @Test
    void updateGroup_DuplicateName_Returns409() throws Exception {
        when(groupService.updateGroup(eq("admin-1"), eq("group-1"), any(UpdateGroupRequest.class)))
                .thenThrow(new ConflictException("Group name is already taken"));

        mockMvc.perform(patch("/api/v1/groups/group-1")
                        .principal(new UsernamePasswordAuthenticationToken("admin-1", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Existing Group"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Group name is already taken"));
    }

    @Test
    void updateGroup_NameTooShort_Returns400() throws Exception {
        mockMvc.perform(patch("/api/v1/groups/group-1")
                        .principal(new UsernamePasswordAuthenticationToken("admin-1", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "ab"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("name: Group name must be between 3 and 100 characters"));
    }

    @Test
    void getGroupMembers_Success_Returns200() throws Exception {
        GroupMemberListResponse response = new GroupMemberListResponse(List.of(
                new GroupMemberResponse("u-1", "Satyam", null, GroupRole.ADMIN, true, Instant.now()),
                new GroupMemberResponse("u-2", "Priya", null, GroupRole.MEMBER, false, Instant.now())
        ));
        when(groupService.getGroupMembers("u-1", "group-1")).thenReturn(response);

        mockMvc.perform(get("/api/v1/groups/group-1/members")
                        .principal(new UsernamePasswordAuthenticationToken("u-1", null, List.of())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].displayName").value("Satyam"))
                .andExpect(jsonPath("$.content[0].role").value("ADMIN"));
    }

    @Test
    void getGroupMembers_NonMember_Returns403() throws Exception {
        when(groupService.getGroupMembers("u-outsider", "group-1"))
                .thenThrow(new ForbiddenException("Must be a group member to view the member list"));

        mockMvc.perform(get("/api/v1/groups/group-1/members")
                        .principal(new UsernamePasswordAuthenticationToken("u-outsider", null, List.of())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Must be a group member to view the member list"));
    }

    @Test
    void updateMemberRole_Success_Returns200() throws Exception {
        GroupMemberResponse response = new GroupMemberResponse("u-2", "Priya", null, GroupRole.ADMIN, false, Instant.now());
        when(groupService.updateMemberRole(eq("admin-1"), eq("group-1"), eq("u-2"), any(UpdateMemberRoleRequest.class)))
                .thenReturn(response);

        mockMvc.perform(patch("/api/v1/groups/group-1/members/u-2/role")
                        .principal(new UsernamePasswordAuthenticationToken("admin-1", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "role": "ADMIN"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("u-2"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void updateMemberRole_NonAdmin_Returns403() throws Exception {
        when(groupService.updateMemberRole(eq("member-1"), eq("group-1"), eq("u-2"), any(UpdateMemberRoleRequest.class)))
                .thenThrow(new ForbiddenException("Only group admins can manage member roles"));

        mockMvc.perform(patch("/api/v1/groups/group-1/members/u-2/role")
                        .principal(new UsernamePasswordAuthenticationToken("member-1", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "role": "ADMIN"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only group admins can manage member roles"));
    }

    @Test
    void updateMemberRole_DemoteSoleAdmin_Returns409() throws Exception {
        when(groupService.updateMemberRole(eq("admin-1"), eq("group-1"), eq("admin-1"), any(UpdateMemberRoleRequest.class)))
                .thenThrow(new ConflictException("Cannot demote the sole admin of the group"));

        mockMvc.perform(patch("/api/v1/groups/group-1/members/admin-1/role")
                        .principal(new UsernamePasswordAuthenticationToken("admin-1", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "role": "MEMBER"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Cannot demote the sole admin of the group"));
    }

    @Test
    void leaveGroup_Success_Returns204() throws Exception {
        mockMvc.perform(post("/api/v1/groups/group-1/leave")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isNoContent());

        verify(groupService).leaveGroup("user-1", "group-1");
    }

    @Test
    void leaveGroup_NotMember_Returns403() throws Exception {
        doThrow(new ForbiddenException("You are not a member of this group"))
                .when(groupService).leaveGroup("user-1", "group-1");

        mockMvc.perform(post("/api/v1/groups/group-1/leave")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You are not a member of this group"));
    }

    @Test
    void leaveGroup_NotFound_Returns404() throws Exception {
        doThrow(new ResourceNotFoundException("Group not found with id: group-1"))
                .when(groupService).leaveGroup("user-1", "group-1");

        mockMvc.perform(post("/api/v1/groups/group-1/leave")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Group not found with id: group-1"));
    }

    @Test
    void removeMember_Success_Returns204() throws Exception {
        mockMvc.perform(delete("/api/v1/groups/group-1/members/target-user")
                        .principal(new UsernamePasswordAuthenticationToken("admin-1", null, List.of())))
                .andExpect(status().isNoContent());

        verify(groupService).removeMember("admin-1", "group-1", "target-user");
    }

    @Test
    void removeMember_Self_Returns400() throws Exception {
        doThrow(new IllegalArgumentException("Admins cannot remove themselves; use leave group instead"))
                .when(groupService).removeMember("admin-1", "group-1", "admin-1");

        mockMvc.perform(delete("/api/v1/groups/group-1/members/admin-1")
                        .principal(new UsernamePasswordAuthenticationToken("admin-1", null, List.of())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Admins cannot remove themselves; use leave group instead"));
    }

    @Test
    void removeMember_NotAdmin_Returns403() throws Exception {
        doThrow(new ForbiddenException("Only group admins can remove members"))
                .when(groupService).removeMember("user-1", "group-1", "target-user");

        mockMvc.perform(delete("/api/v1/groups/group-1/members/target-user")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only group admins can remove members"));
    }

    @Test
    void deleteGroup_Success_Returns204() throws Exception {
        mockMvc.perform(delete("/api/v1/groups/group-1")
                        .principal(new UsernamePasswordAuthenticationToken("admin-1", null, List.of())))
                .andExpect(status().isNoContent());

        verify(groupService).deleteGroup("admin-1", "group-1");
    }

    @Test
    void deleteGroup_NotAdmin_Returns403() throws Exception {
        doThrow(new ForbiddenException("Only group admins can delete the group"))
                .when(groupService).deleteGroup("user-1", "group-1");

        mockMvc.perform(delete("/api/v1/groups/group-1")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only group admins can delete the group"));
    }

    @Test
    void discoverGroups_Success_Returns200() throws Exception {
        GroupResponse groupResponse = new GroupResponse(
                "group-1",
                "Distributed Systems",
                "Desc",
                "system-design",
                GroupVisibility.PUBLIC,
                null,
                null,
                5,
                "conv-1",
                Instant.now(),
                null
        );
        GroupPageResponse pageResponse = new GroupPageResponse(List.of(groupResponse), 0, 20, 1, 1, true);
        when(groupService.discoverGroups(eq("user-1"), eq("Distributed"), eq("system-design"), eq(0), eq(20)))
                .thenReturn(pageResponse);

        mockMvc.perform(get("/api/v1/groups")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of()))
                        .param("q", "Distributed")
                        .param("tag", "system-design")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value("group-1"))
                .andExpect(jsonPath("$.content[0].name").value("Distributed Systems"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void joinPublicGroup_Success_Returns200() throws Exception {
        GroupJoinResponse joinResponse = new GroupJoinResponse("group-1", "conv-1", GroupRole.MEMBER);
        when(groupService.joinPublicGroup("user-1", "group-1")).thenReturn(joinResponse);

        mockMvc.perform(post("/api/v1/groups/group-1/join")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupId").value("group-1"))
                .andExpect(jsonPath("$.conversationId").value("conv-1"))
                .andExpect(jsonPath("$.role").value("MEMBER"));
    }

    @Test
    void joinPublicGroup_PrivateGroup_Returns403() throws Exception {
        when(groupService.joinPublicGroup("user-1", "group-1"))
                .thenThrow(new ForbiddenException("Cannot join private group without an invitation link"));

        mockMvc.perform(post("/api/v1/groups/group-1/join")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Cannot join private group without an invitation link"));
    }

    @Test
    void joinPublicGroup_AlreadyMember_Returns409() throws Exception {
        when(groupService.joinPublicGroup("user-1", "group-1"))
                .thenThrow(new ConflictException("User is already a member of this group"));

        mockMvc.perform(post("/api/v1/groups/group-1/join")
                        .principal(new UsernamePasswordAuthenticationToken("user-1", null, List.of())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("User is already a member of this group"));
    }
}
