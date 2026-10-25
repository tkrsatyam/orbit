package com.orbit.conversation;

import com.orbit.conversation.dto.ConversationListResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller for retrieving conversations and conversation-level metadata.
 * Implements P1-20 (ORDM-51): GET /api/v1/conversations.
 */
@RestController
@RequestMapping("/api/v1/conversations")
@Tag(name = "Conversations", description = "Conversation listing and metadata")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    /**
     * Retrieves all conversations for the authenticated user, ordered by most recent message.
     */
    @Operation(summary = "Get user conversations", description = "Get all conversations for the authenticated user (DMs and groups), ordered by most recent message.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Conversations retrieved successfully",
                    content = @Content(schema = @Schema(implementation = ConversationListResponse.class))),
            @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping
    public ResponseEntity<ConversationListResponse> getConversations(Authentication authentication) {
        String currentUserId = authentication.getName();
        ConversationListResponse response = conversationService.getConversationsForUser(currentUserId);
        return ResponseEntity.ok(response);
    }
}
