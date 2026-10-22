package com.orbit.group;

import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.ForbiddenException;
import com.orbit.common.exception.GlobalExceptionHandler;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.group.dto.CreateGroupRequest;
import com.orbit.group.dto.GroupJoinResponse;
import com.orbit.group.dto.GroupResponse;
import com.orbit.group.dto.InviteResponse;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
}
