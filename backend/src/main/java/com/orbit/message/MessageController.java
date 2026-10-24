package com.orbit.message;

import com.orbit.message.dto.MessageResponse;
import com.orbit.message.dto.SendMessageRequest;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
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
