package com.orbit.contact;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orbit.auth.token.JwtService;
import com.orbit.contact.dto.RequestAction;
import com.orbit.contact.dto.RespondRequestDto;
import com.orbit.contact.dto.SendRequestDto;
import com.orbit.contact.model.Contact;
import com.orbit.contact.model.ContactStatus;
import com.orbit.conversation.ConversationRepository;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import com.orbit.user.model.UserRole;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "spring.mongodb.uri=mongodb://localhost:27017/orbit_test")
class ContactEndpointIntegrationTest {

    private static final String REQUESTS_PATH = "/api/v1/contacts/requests";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ContactRepository contactRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private ObjectMapper objectMapper;

    private User requester;
    private User targetUser;

    @BeforeEach
    void setUp() {
        conversationRepository.deleteAll();
        contactRepository.deleteAll();
        userRepository.deleteAll();

        requester = userRepository.save(User.builder()
                .email("requester@orbit.internal")
                .passwordHash("hashed-pw-1")
                .displayName("Satyam Kumar")
                .role(UserRole.USER)
                .build());

        targetUser = userRepository.save(User.builder()
                .email("target@orbit.internal")
                .passwordHash("hashed-pw-2")
                .displayName("Priya Sharma")
                .avatarUrl("https://example.com/priya.png")
                .role(UserRole.USER)
                .build());
    }

    private String generateToken(User user) {
        return jwtService.generateAccessToken(user.getId());
    }

    @Test
    void postRequestRequiresAuthentication() throws Exception {
        SendRequestDto dto = new SendRequestDto(targetUser.getId());

        mockMvc.perform(post(REQUESTS_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void postRequestSuccessfullyCreatesPendingContact() throws Exception {
        String token = generateToken(requester);
        SendRequestDto dto = new SendRequestDto(targetUser.getId());

        mockMvc.perform(post(REQUESTS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.toUser.id").value(targetUser.getId()))
                .andExpect(jsonPath("$.toUser.displayName").value("Priya Sharma"))
                .andExpect(jsonPath("$.toUser.avatarUrl").value("https://example.com/priya.png"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        assertThat(contactRepository.count()).isEqualTo(1);
        Contact created = contactRepository.findByRequesterIdAndReceiverId(requester.getId(), targetUser.getId()).orElseThrow();
        assertThat(created.getStatus()).isEqualTo(ContactStatus.PENDING);
    }

    @Test
    void postRequestFailsWhenConnectingToSelf() throws Exception {
        String token = generateToken(requester);
        SendRequestDto dto = new SendRequestDto(requester.getId());

        mockMvc.perform(post(REQUESTS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Cannot send a connection request to yourself"));
    }

    @Test
    void postRequestFailsWhenTargetUserNotFound() throws Exception {
        String token = generateToken(requester);
        SendRequestDto dto = new SendRequestDto(new ObjectId().toHexString());

        mockMvc.perform(post(REQUESTS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Target user not found"));
    }

    @Test
    void postRequestFailsWhenDuplicateRequestSent() throws Exception {
        String token = generateToken(requester);
        SendRequestDto dto = new SendRequestDto(targetUser.getId());

        // First request succeeds
        mockMvc.perform(post(REQUESTS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated());

        // Duplicate request returns 409 Conflict
        mockMvc.perform(post(REQUESTS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("A connection request has already been sent to this user"));
    }

    @Test
    void postRequestFailsWhenTargetUserAlreadySentRequest() throws Exception {
        contactRepository.save(Contact.builder()
                .requesterId(targetUser.getId())
                .receiverId(requester.getId())
                .status(ContactStatus.PENDING)
                .build());

        String token = generateToken(requester);
        SendRequestDto dto = new SendRequestDto(targetUser.getId());

        mockMvc.perform(post(REQUESTS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("This user has already sent you a connection request. Please accept or decline it."));
    }

    @Test
    void postRequestFailsWhenAlreadyConnected() throws Exception {
        contactRepository.save(Contact.builder()
                .requesterId(requester.getId())
                .receiverId(targetUser.getId())
                .status(ContactStatus.CONNECTED)
                .build());

        String token = generateToken(requester);
        SendRequestDto dto = new SendRequestDto(targetUser.getId());

        mockMvc.perform(post(REQUESTS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("You are already connected with this user"));
    }

    @Test
    void postRequestFailsWhenRelationshipIsBlocked() throws Exception {
        contactRepository.save(Contact.builder()
                .requesterId(requester.getId())
                .receiverId(targetUser.getId())
                .status(ContactStatus.BLOCKED)
                .blockedBy(targetUser.getId())
                .build());

        String token = generateToken(requester);
        SendRequestDto dto = new SendRequestDto(targetUser.getId());

        mockMvc.perform(post(REQUESTS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Unable to send connection request to this user"));
    }

    @Test
    void preflightCorsOptionsSucceedsForEndpoint() throws Exception {
        mockMvc.perform(options(REQUESTS_PATH)
                        .header(HttpHeaders.ORIGIN, "http://localhost:4200")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization,content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
    }

    @Test
    void getIncomingRequestsReturnsPendingForAuthenticatedUser() throws Exception {
        contactRepository.save(Contact.builder()
                .requesterId(requester.getId())
                .receiverId(targetUser.getId())
                .status(ContactStatus.PENDING)
                .build());

        String targetToken = generateToken(targetUser);

        mockMvc.perform(get(REQUESTS_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + targetToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].fromUser.id").value(requester.getId()))
                .andExpect(jsonPath("$.content[0].fromUser.displayName").value("Satyam Kumar"));
    }

    @Test
    void patchRequestAcceptEstablishesConnectionAndCreatesConversation() throws Exception {
        Contact pending = contactRepository.save(Contact.builder()
                .requesterId(requester.getId())
                .receiverId(targetUser.getId())
                .status(ContactStatus.PENDING)
                .build());

        String targetToken = generateToken(targetUser);
        RespondRequestDto dto = new RespondRequestDto(RequestAction.ACCEPT);

        mockMvc.perform(patch(REQUESTS_PATH + "/" + pending.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + targetToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.conversationId").isNotEmpty());

        Contact updated = contactRepository.findById(pending.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(ContactStatus.CONNECTED);
        assertThat(updated.getConversationId()).isNotNull();

        Conversation conv = conversationRepository.findById(updated.getConversationId()).orElseThrow();
        assertThat(conv.getType()).isEqualTo(ConversationType.DIRECT);
        assertThat(conv.getParticipantIds()).containsExactlyInAnyOrder(requester.getId(), targetUser.getId());
    }

    @Test
    void patchRequestDeclineDeletesContactDocumentQuietly() throws Exception {
        Contact pending = contactRepository.save(Contact.builder()
                .requesterId(requester.getId())
                .receiverId(targetUser.getId())
                .status(ContactStatus.PENDING)
                .build());

        String targetToken = generateToken(targetUser);
        RespondRequestDto dto = new RespondRequestDto(RequestAction.DECLINE);

        mockMvc.perform(patch(REQUESTS_PATH + "/" + pending.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + targetToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNoContent());

        assertThat(contactRepository.findById(pending.getId())).isEmpty();
    }

    @Test
    void patchRequestFailsWhenUserIsNotReceiver() throws Exception {
        Contact pending = contactRepository.save(Contact.builder()
                .requesterId(requester.getId())
                .receiverId(targetUser.getId())
                .status(ContactStatus.PENDING)
                .build());

        // Requester attempts to accept their own sent request
        String requesterToken = generateToken(requester);
        RespondRequestDto dto = new RespondRequestDto(RequestAction.ACCEPT);

        mockMvc.perform(patch(REQUESTS_PATH + "/" + pending.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + requesterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void getContactsRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/contacts"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getContactsReturnsConnectedContactsWithDetails() throws Exception {
        Conversation conv = conversationRepository.save(Conversation.builder()
                .type(ConversationType.DIRECT)
                .participantIds(java.util.List.of(requester.getId(), targetUser.getId()))
                .build());

        contactRepository.save(Contact.builder()
                .requesterId(requester.getId())
                .receiverId(targetUser.getId())
                .status(ContactStatus.CONNECTED)
                .conversationId(conv.getId())
                .build());

        String requesterToken = generateToken(requester);

        mockMvc.perform(get("/api/v1/contacts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + requesterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].userId").value(targetUser.getId()))
                .andExpect(jsonPath("$.content[0].displayName").value(targetUser.getDisplayName()))
                .andExpect(jsonPath("$.content[0].avatarUrl").value(targetUser.getAvatarUrl()))
                .andExpect(jsonPath("$.content[0].online").value(false))
                .andExpect(jsonPath("$.content[0].conversationId").value(conv.getId()));
    }

    @Test
    void deleteContactRequiresAuthentication() throws Exception {
        mockMvc.perform(delete("/api/v1/contacts/any-id"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteContactRemovesDocumentAndPreservesConversation() throws Exception {
        Conversation conv = conversationRepository.save(Conversation.builder()
                .type(ConversationType.DIRECT)
                .participantIds(java.util.List.of(requester.getId(), targetUser.getId()))
                .build());

        Contact connected = contactRepository.save(Contact.builder()
                .requesterId(requester.getId())
                .receiverId(targetUser.getId())
                .status(ContactStatus.CONNECTED)
                .conversationId(conv.getId())
                .build());

        String requesterToken = generateToken(requester);

        // Delete contact using contact document ID
        mockMvc.perform(delete("/api/v1/contacts/" + connected.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + requesterToken))
                .andExpect(status().isNoContent());

        // Verify contact document is hard deleted
        assertThat(contactRepository.findById(connected.getId())).isEmpty();

        // Verify conversation is preserved (ADR 006)
        assertThat(conversationRepository.findById(conv.getId())).isPresent();
    }

    @Test
    void deleteContactRemovesDocumentUsingTargetUserIdFallback() throws Exception {
        Conversation conv = conversationRepository.save(Conversation.builder()
                .type(ConversationType.DIRECT)
                .participantIds(java.util.List.of(requester.getId(), targetUser.getId()))
                .build());

        Contact connected = contactRepository.save(Contact.builder()
                .requesterId(targetUser.getId())
                .receiverId(requester.getId())
                .status(ContactStatus.CONNECTED)
                .conversationId(conv.getId())
                .build());

        String requesterToken = generateToken(requester);

        // Delete contact using the other user's ID
        mockMvc.perform(delete("/api/v1/contacts/" + targetUser.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + requesterToken))
                .andExpect(status().isNoContent());

        // Verify contact document is hard deleted
        assertThat(contactRepository.findById(connected.getId())).isEmpty();
    }

    @Test
    void deleteContactReturns404WhenContactDoesNotExist() throws Exception {
        String requesterToken = generateToken(requester);

        mockMvc.perform(delete("/api/v1/contacts/" + new ObjectId().toHexString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + requesterToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void deleteContactReturns404WhenUserIsNotParticipant() throws Exception {
        User thirdUser = userRepository.save(User.builder()
                .email("third@orbit.internal")
                .passwordHash("hashed-pw-3")
                .displayName("Third Person")
                .role(UserRole.USER)
                .build());

        Contact connected = contactRepository.save(Contact.builder()
                .requesterId(targetUser.getId())
                .receiverId(thirdUser.getId())
                .status(ContactStatus.CONNECTED)
                .build());

        String requesterToken = generateToken(requester);

        mockMvc.perform(delete("/api/v1/contacts/" + connected.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + requesterToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }
}
