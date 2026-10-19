package com.orbit.user;

import com.orbit.common.exception.GlobalExceptionHandler;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.user.dto.ConnectionStatus;
import com.orbit.user.dto.SelfProfileResponse;
import com.orbit.user.dto.UserProfileResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    private static final String ME_PATH = "/api/v1/users/me";
    private static final String USERS_PATH = "/api/v1/users/";

    @Mock
    private UserService userService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        UserController userController = new UserController(userService);
        mockMvc = MockMvcBuilders.standaloneSetup(userController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void getSelfProfileReturns200WithProfileWhenUserFound() throws Exception {
        Instant now = Instant.now();
        SelfProfileResponse response = new SelfProfileResponse(
                "user-123",
                "satyam@example.com",
                "Satyam",
                "https://example.com/avatar.jpg",
                "Software Engineer",
                now
        );

        when(userService.getSelfProfile("user-123")).thenReturn(response);

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("user-123", null, List.of());

        mockMvc.perform(get(ME_PATH).principal(principal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("user-123"))
                .andExpect(jsonPath("$.email").value("satyam@example.com"))
                .andExpect(jsonPath("$.displayName").value("Satyam"))
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/avatar.jpg"))
                .andExpect(jsonPath("$.bio").value("Software Engineer"));
    }

    @Test
    void getSelfProfileReturns404WhenUserNotFound() throws Exception {
        when(userService.getSelfProfile("missing-user"))
                .thenThrow(new ResourceNotFoundException("User not found: missing-user"));

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("missing-user", null, List.of());

        mockMvc.perform(get(ME_PATH).principal(principal))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("User not found: missing-user"))
                .andExpect(jsonPath("$.path").value(ME_PATH));
    }

    @Test
    void getUserProfileReturns200WithPublicProfileWhenFound() throws Exception {
        UserProfileResponse response = new UserProfileResponse(
                "target-456",
                "Rahul",
                "https://example.com/rahul.jpg",
                "Preparing for FAANG",
                ConnectionStatus.CONNECTED,
                null
        );

        when(userService.getUserProfile("target-456", "requester-123")).thenReturn(response);

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("requester-123", null, List.of());

        mockMvc.perform(get(USERS_PATH + "target-456").principal(principal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("target-456"))
                .andExpect(jsonPath("$.displayName").value("Rahul"))
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/rahul.jpg"))
                .andExpect(jsonPath("$.bio").value("Preparing for FAANG"))
                .andExpect(jsonPath("$.connectionStatus").value("CONNECTED"))
                .andExpect(jsonPath("$.available").doesNotExist())
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void getUserProfileReturns200WithMaskedProfileWhenBlocked() throws Exception {
        UserProfileResponse masked = UserProfileResponse.unavailable("target-456");

        when(userService.getUserProfile("target-456", "requester-123")).thenReturn(masked);

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("requester-123", null, List.of());

        mockMvc.perform(get(USERS_PATH + "target-456").principal(principal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("target-456"))
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.displayName").doesNotExist())
                .andExpect(jsonPath("$.bio").doesNotExist())
                .andExpect(jsonPath("$.avatarUrl").doesNotExist())
                .andExpect(jsonPath("$.connectionStatus").doesNotExist());
    }

    @Test
    void getUserProfileReturns404WhenTargetUserNotFound() throws Exception {
        when(userService.getUserProfile("nonexistent", "requester-123"))
                .thenThrow(new ResourceNotFoundException("User not found: nonexistent"));

        UsernamePasswordAuthenticationToken principal =
                UsernamePasswordAuthenticationToken.authenticated("requester-123", null, List.of());

        mockMvc.perform(get(USERS_PATH + "nonexistent").principal(principal))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("User not found: nonexistent"));
    }
}
