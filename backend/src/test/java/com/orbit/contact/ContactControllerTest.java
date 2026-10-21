package com.orbit.contact;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.GlobalExceptionHandler;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.contact.dto.AcceptRequestResponse;
import com.orbit.contact.dto.ConnectionRequestResponse;
import com.orbit.contact.dto.ContactUserSummaryDto;
import com.orbit.contact.dto.IncomingRequestDto;
import com.orbit.contact.dto.IncomingRequestsResponse;
import com.orbit.contact.dto.RequestAction;
import com.orbit.contact.dto.RespondRequestDto;
import com.orbit.contact.dto.SendRequestDto;
import com.orbit.contact.model.ContactStatus;
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

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ContactControllerTest {

    private static final String REQUESTS_PATH = "/api/v1/contacts/requests";

    @Mock
    private ContactService contactService;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ContactController contactController = new ContactController(contactService);
        mockMvc = MockMvcBuilders.standaloneSetup(contactController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void sendRequestReturns201WhenValid() throws Exception {
        SendRequestDto dto = new SendRequestDto("target-456");
        Instant now = Instant.now();

        ConnectionRequestResponse response = ConnectionRequestResponse.builder()
                .id("contact-789")
                .status(ContactStatus.PENDING)
                .toUser(new ContactUserSummaryDto("target-456", "Sneha Kapoor"))
                .createdAt(now)
                .build();

        when(contactService.sendRequest(eq("user-123"), eq("target-456"))).thenReturn(response);

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(post(REQUESTS_PATH)
                        .principal(principal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("contact-789"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.toUser.id").value("target-456"))
                .andExpect(jsonPath("$.toUser.displayName").value("Sneha Kapoor"));
    }

    @Test
    void sendRequestReturns400WhenTargetUserIdBlank() throws Exception {
        SendRequestDto dto = new SendRequestDto("");

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(post(REQUESTS_PATH)
                        .principal(principal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("targetUserId: targetUserId is required"));
    }

    @Test
    void sendRequestReturns400WhenSelfRequest() throws Exception {
        SendRequestDto dto = new SendRequestDto("user-123");

        when(contactService.sendRequest(eq("user-123"), eq("user-123")))
                .thenThrow(new IllegalArgumentException("Cannot send a connection request to yourself"));

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(post(REQUESTS_PATH)
                        .principal(principal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Cannot send a connection request to yourself"));
    }

    @Test
    void sendRequestReturns404WhenTargetUserNotFound() throws Exception {
        SendRequestDto dto = new SendRequestDto("target-not-found");

        when(contactService.sendRequest(eq("user-123"), eq("target-not-found")))
                .thenThrow(new ResourceNotFoundException("Target user not found"));

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(post(REQUESTS_PATH)
                        .principal(principal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Target user not found"));
    }

    @Test
    void sendRequestReturns409WhenConflict() throws Exception {
        SendRequestDto dto = new SendRequestDto("target-456");

        when(contactService.sendRequest(eq("user-123"), eq("target-456")))
                .thenThrow(new ConflictException("A connection request has already been sent to this user"));

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(post(REQUESTS_PATH)
                        .principal(principal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("A connection request has already been sent to this user"));
    }

    @Test
    void getIncomingRequestsReturns200WithContent() throws Exception {
        IncomingRequestDto req = IncomingRequestDto.builder()
                .id("req-123")
                .fromUser(new ContactUserSummaryDto("sender-1", "Alice", "https://avatar.url/1.png"))
                .createdAt(Instant.parse("2026-10-21T00:00:00Z"))
                .build();
        IncomingRequestsResponse response = new IncomingRequestsResponse(List.of(req));

        when(contactService.getIncomingRequests("user-123")).thenReturn(response);

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(get(REQUESTS_PATH)
                        .principal(principal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value("req-123"))
                .andExpect(jsonPath("$.content[0].fromUser.displayName").value("Alice"))
                .andExpect(jsonPath("$.content[0].fromUser.avatarUrl").value("https://avatar.url/1.png"));
    }

    @Test
    void respondToRequestAcceptReturns200WithConversationId() throws Exception {
        RespondRequestDto dto = new RespondRequestDto(RequestAction.ACCEPT);
        AcceptRequestResponse response = AcceptRequestResponse.builder()
                .status("ACCEPTED")
                .conversationId("conv-456")
                .build();

        when(contactService.respondToRequest("user-123", "req-1", RequestAction.ACCEPT))
                .thenReturn(response);

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(patch(REQUESTS_PATH + "/req-1")
                        .principal(principal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.conversationId").value("conv-456"));
    }

    @Test
    void respondToRequestDeclineReturns204() throws Exception {
        RespondRequestDto dto = new RespondRequestDto(RequestAction.DECLINE);

        when(contactService.respondToRequest("user-123", "req-1", RequestAction.DECLINE))
                .thenReturn(null);

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(patch(REQUESTS_PATH + "/req-1")
                        .principal(principal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNoContent());
    }

    @Test
    void respondToRequestReturns404WhenNotFound() throws Exception {
        RespondRequestDto dto = new RespondRequestDto(RequestAction.ACCEPT);

        when(contactService.respondToRequest("user-123", "req-999", RequestAction.ACCEPT))
                .thenThrow(new ResourceNotFoundException("Connection request not found"));

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(patch(REQUESTS_PATH + "/req-999")
                        .principal(principal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Connection request not found"));
    }

    @Test
    void respondToRequestReturns409WhenConflict() throws Exception {
        RespondRequestDto dto = new RespondRequestDto(RequestAction.ACCEPT);

        when(contactService.respondToRequest("user-123", "req-1", RequestAction.ACCEPT))
                .thenThrow(new ConflictException("Connection request is not in PENDING state"));

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(patch(REQUESTS_PATH + "/req-1")
                        .principal(principal)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Connection request is not in PENDING state"));
    }
}
