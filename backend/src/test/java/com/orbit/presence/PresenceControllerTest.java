package com.orbit.presence;

import com.orbit.presence.dto.TypingRequest;
import com.orbit.websocket.StompPrincipal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class PresenceControllerTest {

    @Mock
    private PresenceService presenceService;

    @InjectMocks
    private PresenceController presenceController;

    @Test
    @DisplayName("Should invoke PresenceService with authenticated principal and typing status")
    void shouldInvokePresenceServiceWhenAuthenticated() {
        Principal principal = new StompPrincipal("user-1");
        TypingRequest request = new TypingRequest(true);

        presenceController.handleTyping("conv-123", request, principal);

        verify(presenceService).handleTyping("conv-123", "user-1", true);
    }

    @Test
    @DisplayName("Should ignore typing request if principal is null")
    void shouldIgnoreWhenPrincipalIsNull() {
        TypingRequest request = new TypingRequest(true);

        presenceController.handleTyping("conv-123", request, null);

        verify(presenceService, never()).handleTyping("conv-123", "user-1", true);
    }

    @Test
    @DisplayName("Should ignore typing request if request or typing flag is null")
    void shouldIgnoreWhenRequestOrTypingIsNull() {
        Principal principal = new StompPrincipal("user-1");

        presenceController.handleTyping("conv-123", null, principal);
        presenceController.handleTyping("conv-123", new TypingRequest(null), principal);

        verify(presenceService, never()).handleTyping("conv-123", "user-1", true);
    }
}
