package com.orbit.group;

import com.orbit.auth.token.AccessTokenClaims;
import com.orbit.auth.token.JwtService;
import com.orbit.conversation.ConversationRepository;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import com.orbit.group.model.Group;
import com.orbit.group.model.GroupMember;
import com.orbit.group.model.GroupRole;
import com.orbit.group.model.GroupVisibility;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import com.orbit.user.model.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "spring.mongodb.uri=mongodb://localhost:27017/orbit_test")
class GroupEndpointIntegrationTest {

    private static final String GROUPS_PATH = "/api/v1/groups";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    private User adminUser;
    private User regularUser;
    private String adminToken;
    private String regularToken;

    @BeforeEach
    void setUp() {
        groupRepository.deleteAll();
        conversationRepository.deleteAll();
        userRepository.deleteAll();

        adminUser = userRepository.save(User.builder()
                .email("admin@example.com")
                .passwordHash("hashed")
                .displayName("Admin User")
                .role(UserRole.USER)
                .build());

        regularUser = userRepository.save(User.builder()
                .email("regular@example.com")
                .passwordHash("hashed")
                .displayName("Regular User")
                .role(UserRole.USER)
                .build());

        adminToken = jwtService.generateAccessToken(adminUser.getId());
        regularToken = jwtService.generateAccessToken(regularUser.getId());
    }

    @Test
    void createGroup_WithoutAuth_Returns401() throws Exception {
        mockMvc.perform(post(GROUPS_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Unauthorized Group",
                                  "visibility": "PUBLIC"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createGroup_ValidPayload_CreatesGroupAndConversationInMongo() throws Exception {
        mockMvc.perform(post(GROUPS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "System Design Hub",
                                  "description": "Weekly system design deep dives",
                                  "topicTag": "system-design",
                                  "visibility": "PUBLIC"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("System Design Hub"))
                .andExpect(jsonPath("$.topicTag").value("system-design"))
                .andExpect(jsonPath("$.visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.memberCount").value(1))
                .andExpect(jsonPath("$.role").value("ADMIN"));

        List<Group> groups = groupRepository.findAll();
        assertThat(groups).hasSize(1);
        Group group = groups.get(0);
        assertThat(group.getName()).isEqualTo("System Design Hub");
        assertThat(group.getMembers()).hasSize(1);
        assertThat(group.getMembers().get(0).getUserId()).isEqualTo(adminUser.getId());
        assertThat(group.getMembers().get(0).getRole()).isEqualTo(GroupRole.ADMIN);

        Conversation conv = conversationRepository.findById(group.getConversationId()).orElse(null);
        assertThat(conv).isNotNull();
        assertThat(conv.getType()).isEqualTo(ConversationType.GROUP);
        assertThat(conv.getGroupId()).isEqualTo(group.getId());
        assertThat(conv.getParticipantIds()).contains(adminUser.getId());
    }

    @Test
    void createGroup_DuplicateName_Returns409() throws Exception {
        groupRepository.save(Group.builder()
                .name("System Design Hub")
                .visibility(GroupVisibility.PUBLIC)
                .members(List.of(GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build()))
                .build());

        mockMvc.perform(post(GROUPS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "system design hub",
                                  "visibility": "PUBLIC"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Group name is already taken"));
    }

    @Test
    void getMyGroups_ReturnsUserGroups() throws Exception {
        Group g = groupRepository.save(Group.builder()
                .name("My Joined Group")
                .visibility(GroupVisibility.PUBLIC)
                .members(List.of(GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build()))
                .build());

        mockMvc.perform(get(GROUPS_PATH + "/mine")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(g.getId()))
                .andExpect(jsonPath("$[0].name").value("My Joined Group"))
                .andExpect(jsonPath("$[0].role").value("ADMIN"));
    }

    @Test
    void createInvite_AsAdmin_Returns201AndStoresToken() throws Exception {
        Group group = groupRepository.save(Group.builder()
                .name("Private Engineering")
                .visibility(GroupVisibility.PRIVATE)
                .members(List.of(GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build()))
                .build());

        mockMvc.perform(post(GROUPS_PATH + "/" + group.getId() + "/invite")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.inviteLink").isNotEmpty())
                .andExpect(jsonPath("$.expiresAt").isNotEmpty());

        Group updated = groupRepository.findById(group.getId()).orElseThrow();
        assertThat(updated.getInviteToken()).isNotNull();
        assertThat(updated.getInviteTokenExpiresAt()).isAfter(Instant.now());
    }

    @Test
    void createInvite_AsNonAdmin_Returns403() throws Exception {
        Group group = groupRepository.save(Group.builder()
                .name("Private Engineering")
                .visibility(GroupVisibility.PRIVATE)
                .members(List.of(
                        GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build(),
                        GroupMember.builder().userId(regularUser.getId()).role(GroupRole.MEMBER).build()
                ))
                .build());

        mockMvc.perform(post(GROUPS_PATH + "/" + group.getId() + "/invite")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + regularToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only group admins can generate invite links"));
    }

    @Test
    void joinViaInvite_Success_AddsMemberAndConversationParticipant() throws Exception {
        Conversation conv = conversationRepository.save(Conversation.builder()
                .type(ConversationType.GROUP)
                .participantIds(new ArrayList<>(List.of(adminUser.getId())))
                .build());

        Group group = groupRepository.save(Group.builder()
                .name("Private Team")
                .conversationId(conv.getId())
                .visibility(GroupVisibility.PRIVATE)
                .memberCount(1)
                .inviteToken("inv-token-999")
                .inviteTokenExpiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build()
                )))
                .build());

        mockMvc.perform(post(GROUPS_PATH + "/join-via-invite/inv-token-999")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + regularToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groupId").value(group.getId()))
                .andExpect(jsonPath("$.conversationId").value(conv.getId()))
                .andExpect(jsonPath("$.role").value("MEMBER"));

        Group joinedGroup = groupRepository.findById(group.getId()).orElseThrow();
        assertThat(joinedGroup.getMemberCount()).isEqualTo(2);
        assertThat(joinedGroup.getMembers()).hasSize(2);
        assertThat(joinedGroup.getMembers().get(1).getUserId()).isEqualTo(regularUser.getId());

        Conversation updatedConv = conversationRepository.findById(conv.getId()).orElseThrow();
        assertThat(updatedConv.getParticipantIds()).contains(regularUser.getId());
    }

    @Test
    void joinViaInvite_AlreadyMember_Returns409() throws Exception {
        Group group = groupRepository.save(Group.builder()
                .name("Private Team")
                .visibility(GroupVisibility.PRIVATE)
                .memberCount(1)
                .inviteToken("inv-token-999")
                .inviteTokenExpiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId(regularUser.getId()).role(GroupRole.MEMBER).build()
                )))
                .build());

        mockMvc.perform(post(GROUPS_PATH + "/join-via-invite/inv-token-999")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + regularToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("User is already a member of this group"));
    }

    @Test
    void joinViaInvite_ExpiredToken_Returns404() throws Exception {
        groupRepository.save(Group.builder()
                .name("Private Team")
                .visibility(GroupVisibility.PRIVATE)
                .inviteToken("expired-token")
                .inviteTokenExpiresAt(Instant.now().minus(1, ChronoUnit.DAYS))
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build()
                )))
                .build());

        mockMvc.perform(post(GROUPS_PATH + "/join-via-invite/expired-token")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + regularToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Invite link is invalid or has expired"));
    }

    @Test
    void getGroupDetails_PublicGroup_Returns200() throws Exception {
        Group group = groupRepository.save(Group.builder()
                .name("Public Architecture Space")
                .topicTag("#architecture")
                .description("System design discussions")
                .visibility(GroupVisibility.PUBLIC)
                .memberCount(1)
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build()
                )))
                .build());

        mockMvc.perform(get(GROUPS_PATH + "/" + group.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + regularToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(group.getId()))
                .andExpect(jsonPath("$.name").value("Public Architecture Space"))
                .andExpect(jsonPath("$.topicTag").value("#architecture"));
    }

    @Test
    void getGroupDetails_PrivateGroup_NonMember_Returns404() throws Exception {
        Group group = groupRepository.save(Group.builder()
                .name("Private Stealth Project")
                .visibility(GroupVisibility.PRIVATE)
                .memberCount(1)
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build()
                )))
                .build());

        mockMvc.perform(get(GROUPS_PATH + "/" + group.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + regularToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Group not found"));
    }

    @Test
    void updateGroup_Admin_SucceedsAndPersists() throws Exception {
        Group group = groupRepository.save(Group.builder()
                .name("Initial Group Name")
                .topicTag("#initial")
                .description("Initial description")
                .visibility(GroupVisibility.PUBLIC)
                .memberCount(1)
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build()
                )))
                .build());

        mockMvc.perform(patch(GROUPS_PATH + "/" + group.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Updated Space Name",
                                  "topicTag": "spring-boot",
                                  "description": "Updated detailed description"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Space Name"))
                .andExpect(jsonPath("$.topicTag").value("#spring-boot"))
                .andExpect(jsonPath("$.description").value("Updated detailed description"));

        Group updated = groupRepository.findById(group.getId()).orElseThrow();
        assertThat(updated.getName()).isEqualTo("Updated Space Name");
        assertThat(updated.getTopicTag()).isEqualTo("#spring-boot");
    }

    @Test
    void updateGroup_NonAdmin_FailsWith403() throws Exception {
        Group group = groupRepository.save(Group.builder()
                .name("Protected Group")
                .visibility(GroupVisibility.PUBLIC)
                .memberCount(2)
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build(),
                        GroupMember.builder().userId(regularUser.getId()).role(GroupRole.MEMBER).build()
                )))
                .build());

        mockMvc.perform(patch(GROUPS_PATH + "/" + group.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + regularToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Hacked Name"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only group admins can update group details"));
    }

    @Test
    void updateGroup_DuplicateName_FailsWith409() throws Exception {
        groupRepository.save(Group.builder()
                .name("Existing Group")
                .visibility(GroupVisibility.PUBLIC)
                .memberCount(1)
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build()
                )))
                .build());

        Group groupToUpdate = groupRepository.save(Group.builder()
                .name("Second Group")
                .visibility(GroupVisibility.PUBLIC)
                .memberCount(1)
                .members(new ArrayList<>(List.of(
                        GroupMember.builder().userId(adminUser.getId()).role(GroupRole.ADMIN).build()
                )))
                .build());

        mockMvc.perform(patch(GROUPS_PATH + "/" + groupToUpdate.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Existing Group"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Group name is already taken"));
    }
}
