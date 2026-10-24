package com.orbit.message;

import com.orbit.message.dto.MessageResponse;
import com.orbit.message.dto.SendMessageRequest;
import com.orbit.message.model.MessageType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.security.Principal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageControllerTest {

    @Mock
    private MessageService messageService;

    @Mock
    private Authentication authentication;

    @Mock
    private Principal principal;

    private MessageController messageController;

    private final String conversationId = "conv-123";
    private final String senderId = "user-sender";

    @BeforeEach
    void setUp() {
        messageController = new MessageController(messageService);
    }

    @Test
    @DisplayName("REST sendRestMessage delegates to MessageService and returns 201 Created")
    void shouldSendRestMessage_AndReturnCreated() {
        when(authentication.getName()).thenReturn(senderId);

        MessageResponse expectedResponse = new MessageResponse(
                "msg-1",
                conversationId,
                senderId,
                "Satyam Kumar",
                MessageType.TEXT,
                "Hello REST",
                false,
                false,
                Instant.now()
        );
        when(messageService.sendMessage(eq(conversationId), eq(senderId), any(SendMessageRequest.class)))
                .thenReturn(expectedResponse);

        SendMessageRequest request = new SendMessageRequest("Hello REST", MessageType.TEXT, null);
        ResponseEntity<MessageResponse> responseEntity = messageController.sendRestMessage(
                conversationId,
                "uuid-idem-1",
                request,
                authentication
        );

        assertThat(responseEntity.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(responseEntity.getBody()).isEqualTo(expectedResponse);

        ArgumentCaptor<SendMessageRequest> captor = ArgumentCaptor.forClass(SendMessageRequest.class);
        verify(messageService).sendMessage(eq(conversationId), eq(senderId), captor.capture());
        assertThat(captor.getValue().idempotencyKey()).isEqualTo("uuid-idem-1");
    }

    @Test
    @DisplayName("STOMP sendStompMessage delegates to MessageService and returns receipt")
    void shouldSendStompMessage_AndReturnReceipt() {
        when(principal.getName()).thenReturn(senderId);

        MessageResponse expectedResponse = new MessageResponse(
                "msg-2",
                conversationId,
                senderId,
                "Satyam Kumar",
                MessageType.TEXT,
                "Hello STOMP",
                false,
                false,
                Instant.now()
        );
        when(messageService.sendMessage(eq(conversationId), eq(senderId), any(SendMessageRequest.class)))
                .thenReturn(expectedResponse);

        SendMessageRequest request = new SendMessageRequest("Hello STOMP", MessageType.TEXT, "uuid-stomp-1");
        MessageResponse receipt = messageController.sendStompMessage(conversationId, request, principal);

        assertThat(receipt).isEqualTo(expectedResponse);
        verify(messageService).sendMessage(eq(conversationId), eq(senderId), eq(request));
    }

    @Test
    @DisplayName("STOMP sendStompMessage throws IllegalArgumentException when unauthenticated")
    void shouldThrowException_WhenStompPrincipalNull() {
        SendMessageRequest request = new SendMessageRequest("Hello");

        assertThatThrownBy(() -> messageController.sendStompMessage(conversationId, request, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unauthenticated");
    }
}
