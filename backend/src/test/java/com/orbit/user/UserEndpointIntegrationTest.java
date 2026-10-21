package com.orbit.user;

import com.orbit.auth.token.AccessTokenClaims;
import com.orbit.auth.token.JwtService;
import com.orbit.auth.token.TokenBlacklistService;
import com.orbit.contact.ContactRepository;
import com.orbit.contact.model.Contact;
import com.orbit.contact.model.ContactStatus;
import com.orbit.user.model.User;
import com.orbit.user.model.UserRole;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "spring.mongodb.uri=mongodb://localhost:27017/orbit_test")
class UserEndpointIntegrationTest {

    private static final String ME_PATH = "/api/v1/users/me";
    private static final String USERS_PATH = "/api/v1/users/";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ContactRepository contactRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private TokenBlacklistService tokenBlacklistService;

    private User seededUser;
    private User otherUser;

    @BeforeEach
    void setUp() {
        contactRepository.deleteAll();
        userRepository.deleteAll();

        seededUser = userRepository.save(User.builder()
                .email("satyam.profile@example.com")
                .passwordHash("hashed-pw")
                .displayName("Satyam Kumar")
                .bio("Building Orbit chat app")
                .avatarUrl("https://example.com/satyam.png")
                .role(UserRole.USER)
                .online(true)
                .build());

        otherUser = userRepository.save(User.builder()
                .email("other.user@example.com")
                .passwordHash("hashed-pw-2")
                .displayName("Other User")
                .bio("Other bio")
                .avatarUrl("https://example.com/other.png")
                .role(UserRole.USER)
                .online(false)
                .build());
    }

    @Test
    void getSelfProfileWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get(ME_PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.path").value(ME_PATH));
    }

    @Test
    void getSelfProfileWithInvalidTokenReturns401() throws Exception {
        mockMvc.perform(get(ME_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token-xyz"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"));
    }

    @Test
    void getSelfProfileWithValidBearerTokenReturns200AndFullProfile() throws Exception {
        String token = jwtService.generateAccessToken(seededUser.getId());

        mockMvc.perform(get(ME_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(seededUser.getId()))
                .andExpect(jsonPath("$.email").value("satyam.profile@example.com"))
                .andExpect(jsonPath("$.displayName").value("Satyam Kumar"))
                .andExpect(jsonPath("$.bio").value("Building Orbit chat app"))
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/satyam.png"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void getSelfProfileWithNonExistentUserTokenReturns404() throws Exception {
        String nonexistentUserId = new ObjectId().toHexString();
        String token = jwtService.generateAccessToken(nonexistentUserId);

        mockMvc.perform(get(ME_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.path").value(ME_PATH));
    }

    @Test
    void getSelfProfileWithBlacklistedTokenReturns401() throws Exception {
        String token = jwtService.generateAccessToken(seededUser.getId());
        AccessTokenClaims claims = jwtService.validateToken(token);
        tokenBlacklistService.blacklist(claims.tokenId(), claims.expiresAt());

        mockMvc.perform(get(ME_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void getSelfProfileWithNullBioAndAvatarReturnsNullsGracefully() throws Exception {
        User minimalUser = userRepository.save(User.builder()
                .email("minimal@example.com")
                .passwordHash("hashed")
                .displayName("Minimal User")
                .bio(null)
                .avatarUrl(null)
                .role(UserRole.USER)
                .build());

        String token = jwtService.generateAccessToken(minimalUser.getId());

        mockMvc.perform(get(ME_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(minimalUser.getId()))
                .andExpect(jsonPath("$.email").value("minimal@example.com"))
                .andExpect(jsonPath("$.displayName").value("Minimal User"))
                .andExpect(jsonPath("$.bio").isEmpty())
                .andExpect(jsonPath("$.avatarUrl").isEmpty());
    }

    @Test
    void getSelfProfilePreflightCorsAllowsFrontendOrigin() throws Exception {
        mockMvc.perform(options(ME_PATH)
                        .header(HttpHeaders.ORIGIN, "http://localhost:4200")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))
                .andExpect(header().exists(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS));
    }

    // --- GET /api/v1/users/{userId} Integration Tests ---

    @Test
    void getUserProfileWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get(USERS_PATH + otherUser.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"));
    }

    @Test
    void getUserProfileWithNonExistentTargetReturns404() throws Exception {
        String token = jwtService.generateAccessToken(seededUser.getId());
        String nonexistentUserId = new ObjectId().toHexString();

        mockMvc.perform(get(USERS_PATH + nonexistentUserId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"));
    }

    @Test
    void getUserProfileWhenNoRelationshipReturns200WithNoneStatus() throws Exception {
        String token = jwtService.generateAccessToken(seededUser.getId());

        mockMvc.perform(get(USERS_PATH + otherUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(otherUser.getId()))
                .andExpect(jsonPath("$.displayName").value("Other User"))
                .andExpect(jsonPath("$.bio").value("Other bio"))
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/other.png"))
                .andExpect(jsonPath("$.connectionStatus").value("NONE"))
                .andExpect(jsonPath("$.available").doesNotExist())
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void getUserProfileWhenPendingSentReturns200WithPendingSent() throws Exception {
        contactRepository.save(Contact.builder()
                .requesterId(seededUser.getId())
                .receiverId(otherUser.getId())
                .status(ContactStatus.PENDING)
                .build());

        String token = jwtService.generateAccessToken(seededUser.getId());

        mockMvc.perform(get(USERS_PATH + otherUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connectionStatus").value("PENDING_SENT"))
                .andExpect(jsonPath("$.available").doesNotExist());
    }

    @Test
    void getUserProfileWhenPendingReceivedReturns200WithPendingReceived() throws Exception {
        contactRepository.save(Contact.builder()
                .requesterId(otherUser.getId())
                .receiverId(seededUser.getId())
                .status(ContactStatus.PENDING)
                .build());

        String token = jwtService.generateAccessToken(seededUser.getId());

        mockMvc.perform(get(USERS_PATH + otherUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connectionStatus").value("PENDING_RECEIVED"))
                .andExpect(jsonPath("$.available").doesNotExist());
    }

    @Test
    void getUserProfileWhenConnectedReturns200WithConnected() throws Exception {
        contactRepository.save(Contact.builder()
                .requesterId(seededUser.getId())
                .receiverId(otherUser.getId())
                .status(ContactStatus.CONNECTED)
                .conversationId(new ObjectId().toHexString())
                .build());

        String token = jwtService.generateAccessToken(seededUser.getId());

        mockMvc.perform(get(USERS_PATH + otherUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connectionStatus").value("CONNECTED"))
                .andExpect(jsonPath("$.available").doesNotExist());
    }

    @Test
    void getUserProfileWhenBlockedByTargetReturns200WithMaskedProfile() throws Exception {
        // otherUser blocked seededUser
        contactRepository.save(Contact.builder()
                .requesterId(seededUser.getId())
                .receiverId(otherUser.getId())
                .status(ContactStatus.BLOCKED)
                .blockedBy(otherUser.getId())
                .build());

        String token = jwtService.generateAccessToken(seededUser.getId());

        mockMvc.perform(get(USERS_PATH + otherUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(otherUser.getId()))
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.displayName").doesNotExist())
                .andExpect(jsonPath("$.bio").doesNotExist())
                .andExpect(jsonPath("$.avatarUrl").doesNotExist())
                .andExpect(jsonPath("$.connectionStatus").doesNotExist())
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void getUserProfileWhenRequesterIsBlockerReturns200WithBlockedStatus() throws Exception {
        // seededUser blocked otherUser (asymmetric visibility: blocker sees full profile)
        contactRepository.save(Contact.builder()
                .requesterId(seededUser.getId())
                .receiverId(otherUser.getId())
                .status(ContactStatus.BLOCKED)
                .blockedBy(seededUser.getId())
                .build());

        String token = jwtService.generateAccessToken(seededUser.getId());

        mockMvc.perform(get(USERS_PATH + otherUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(otherUser.getId()))
                .andExpect(jsonPath("$.displayName").value("Other User"))
                .andExpect(jsonPath("$.bio").value("Other bio"))
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/other.png"))
                .andExpect(jsonPath("$.connectionStatus").value("BLOCKED"))
                .andExpect(jsonPath("$.available").doesNotExist());
    }

    @Test
    void getUserProfileWhenViewingSelfReturns200WithNoneStatus() throws Exception {
        String token = jwtService.generateAccessToken(seededUser.getId());

        mockMvc.perform(get(USERS_PATH + seededUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(seededUser.getId()))
                .andExpect(jsonPath("$.displayName").value("Satyam Kumar"))
                .andExpect(jsonPath("$.connectionStatus").value("NONE"))
                .andExpect(jsonPath("$.available").doesNotExist());
    }

    @Test
    void getSuggestedUsersReturnsOnlyUnconnectedUsersExcludingSelf() throws Exception {
        User unconnectedUser = userRepository.save(User.builder()
                .email("unconnected@example.com")
                .passwordHash("hashed-pw")
                .displayName("Unconnected Builder")
                .bio("Looking to connect")
                .role(UserRole.USER)
                .build());

        // Connect seededUser and otherUser
        contactRepository.save(Contact.builder()
                .requesterId(seededUser.getId())
                .receiverId(otherUser.getId())
                .status(ContactStatus.CONNECTED)
                .build());

        String token = jwtService.generateAccessToken(seededUser.getId());

        mockMvc.perform(get("/api/v1/users/suggested")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(unconnectedUser.getId()))
                .andExpect(jsonPath("$[0].displayName").value("Unconnected Builder"))
                .andExpect(jsonPath("$[0].initials").value("UB"));
    }

    @Test
    void getSuggestedUsersReturns401WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/users/suggested"))
                .andExpect(status().isUnauthorized());
    }
}
