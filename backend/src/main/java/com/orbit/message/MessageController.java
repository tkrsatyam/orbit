package com.orbit.message;

import com.orbit.message.dto.EditMessageRequest;
import com.orbit.message.dto.MessageHistoryResponse;
import com.orbit.message.dto.MessageResponse;
import com.orbit.message.dto.SendMessageRequest;
import com.orbit.message.model.MessageDeleteMode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

/**
 * Controller handling both STOMP WebSocket messages and REST fallback message sends.
 * Follows Flow A and Flow C from docs/architecture/sequences/message_send_flow.md.
 */
@RestController
@Tag(name = "Messages", description = "Message operations within conversations")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    /**
     * REST endpoint for sending a message (Flow C - REST Fallback).
     */
    @Operation(summary = "Send a message", description = "Sends a message to a conversation. Supports idempotent retries via X-Idempotency-Key header.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Message sent successfully",
                    content = @Content(schema = @Schema(implementation = MessageResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid request or blank content"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden - sender is not a conversation participant"),
            @ApiResponse(responseCode = "404", description = "Conversation not found"),
            @ApiResponse(responseCode = "429", description = "Rate limit exceeded (60 messages/min)")
    })
    @Parameter(name = "X-Idempotency-Key", in = ParameterIn.HEADER, description = "Client UUID for idempotent deduplication", required = false)
    @PostMapping("/api/v1/conversations/{id}/messages")
    public ResponseEntity<MessageResponse> sendRestMessage(
            @PathVariable("id") String conversationId,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKeyHeader,
            @Valid @RequestBody SendMessageRequest request,
            Authentication authentication) {

        String senderId = authentication.getName();
        String idempotencyKey = idempotencyKeyHeader != null && !idempotencyKeyHeader.isBlank()
                ? idempotencyKeyHeader
                : request.idempotencyKey();

        SendMessageRequest enrichedRequest = new SendMessageRequest(
                request.content(),
                request.type(),
                idempotencyKey
        );

        MessageResponse response = messageService.sendMessage(conversationId, senderId, enrichedRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * REST endpoint for retrieving paginated message history.
     */
    @Operation(summary = "Get conversation messages", description = "Retrieves paginated message history in chronological order. Supports cursor pagination via the 'before' parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Message history retrieved successfully",
                    content = @Content(schema = @Schema(implementation = MessageHistoryResponse.class))),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden - requester is not a conversation participant"),
            @ApiResponse(responseCode = "404", description = "Conversation or cursor message not found")
    })
    @GetMapping("/api/v1/conversations/{id}/messages")
    public ResponseEntity<MessageHistoryResponse> getConversationMessages(
            @PathVariable("id") String conversationId,
            @Parameter(description = "Number of messages to retrieve (default 50, max 100)")
            @RequestParam(value = "size", required = false, defaultValue = "50") Integer size,
            @Parameter(description = "Message ID cursor to fetch messages before")
            @RequestParam(value = "before", required = false) String before,
            Authentication authentication) {

        String currentUserId = authentication.getName();
        MessageHistoryResponse response = messageService.getConversationMessages(conversationId, currentUserId, size, before);
        return ResponseEntity.ok(response);
    }

    /**
     * REST endpoint for editing a message.
     */
    @Operation(summary = "Edit message", description = "Edits message text content. Only permitted for sender on TEXT messages.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Message edited successfully",
                    content = @Content(schema = @Schema(implementation = MessageResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid request or cannot edit deleted/non-text message"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden - sender is not author"),
            @ApiResponse(responseCode = "404", description = "Conversation or message not found")
    })
    @PatchMapping("/api/v1/conversations/{id}/messages/{messageId}")
    public ResponseEntity<MessageResponse> editMessage(
            @PathVariable("id") String conversationId,
            @PathVariable("messageId") String messageId,
            @Valid @RequestBody EditMessageRequest request,
            Authentication authentication) {

        String currentUserId = authentication.getName();
        MessageResponse response = messageService.editMessage(conversationId, messageId, currentUserId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * REST endpoint for deleting a message.
     */
    @Operation(summary = "Delete message", description = "Deletes a message with mode=FOR_EVERYONE (soft delete) or mode=FOR_ME (per-user delete).")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Message deleted successfully"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden - not sender/admin for FOR_EVERYONE"),
            @ApiResponse(responseCode = "404", description = "Conversation or message not found")
    })
    @DeleteMapping("/api/v1/conversations/{id}/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            @PathVariable("id") String conversationId,
            @PathVariable("messageId") String messageId,
            @RequestParam(value = "mode", required = false, defaultValue = "FOR_EVERYONE") MessageDeleteMode mode,
            Authentication authentication) {

        String currentUserId = authentication.getName();
        messageService.deleteMessage(conversationId, messageId, currentUserId, mode);
        return ResponseEntity.noContent().build();
    }

    /**
     * STOMP endpoint for sending a message (Flow A - Primary WebSocket Path).
     * Destination: /app/conversations/{id}/send
     * Receipt delivered to user destination: /user/queue/receipts
     */
    @MessageMapping("/conversations/{id}/send")
    @SendToUser("/queue/receipts")
    public MessageResponse sendStompMessage(
            @DestinationVariable("id") String conversationId,
            @Payload @Valid SendMessageRequest request,
            Principal principal) {

        if (principal == null) {
            throw new IllegalArgumentException("Unauthenticated STOMP session");
        }

        String senderId = principal.getName();
        return messageService.sendMessage(conversationId, senderId, request);
    }
}
