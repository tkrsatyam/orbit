package com.orbit.presence;

import com.orbit.presence.dto.TypingRequest;
import jakarta.validation.Valid;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * Controller handling STOMP WebSocket typing indicator signals.
 * Follows Flow B from docs/architecture/sequences/presence_flow.md.
 */
@Controller
public class PresenceController {

    private final PresenceService presenceService;

    public PresenceController(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    /**
     * STOMP endpoint for client typing indicator signals.
     * Destination: /app/conversations/{id}/typing
     */
    @MessageMapping("/conversations/{id}/typing")
    public void handleTyping(
            @DestinationVariable("id") String conversationId,
            @Payload(required = false) @Valid TypingRequest request,
            Principal principal) {

        if (principal == null || request == null || request.typing() == null) {
            return;
        }

        presenceService.handleTyping(conversationId, principal.getName(), request.typing());
    }
}
