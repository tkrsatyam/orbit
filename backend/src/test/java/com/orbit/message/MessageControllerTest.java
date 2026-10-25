package com.orbit.message;

import com.orbit.message.dto.EditMessageRequest;
import com.orbit.message.dto.MessageHistoryResponse;
import com.orbit.message.dto.MessageResponse;
import com.orbit.message.dto.ReadReceiptRequest;
import com.orbit.message.dto.SendMessageRequest;
import com.orbit.message.model.MessageDeleteMode;
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

    @Test
    @DisplayName("REST getConversationMessages delegates to MessageService and returns 200 OK")
    void shouldGetConversationMessages_AndReturnOk() {
        when(authentication.getName()).thenReturn(senderId);

        MessageHistoryResponse expectedHistory = new MessageHistoryResponse(
                java.util.List.of(),
                false,
                null
        );
        when(messageService.getConversationMessages(conversationId, senderId, 50, "msg-cursor"))
                .thenReturn(expectedHistory);

        ResponseEntity<MessageHistoryResponse> responseEntity = messageController.getConversationMessages(
                conversationId,
                50,
                "msg-cursor",
                authentication
        );

        assertThat(responseEntity.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(responseEntity.getBody()).isEqualTo(expectedHistory);
        verify(messageService).getConversationMessages(conversationId, senderId, 50, "msg-cursor");
    }

    @Test
    @DisplayName("REST editMessage delegates to MessageService and returns 200 OK")
    void shouldEditMessage_AndReturnOk() {
        when(authentication.getName()).thenReturn(senderId);

        EditMessageRequest editRequest = new EditMessageRequest("Updated content text");
        MessageResponse editedResponse = new MessageResponse(
                "msg-1",
                conversationId,
                senderId,
                "Satyam Kumar",
                MessageType.TEXT,
                "Updated content text",
                false,
                true,
                Instant.now(),
                Instant.now(),
                com.orbit.message.model.MessageDeliveryStatus.DELIVERED
        );

        when(messageService.editMessage(eq(conversationId), eq("msg-1"), eq(senderId), any(EditMessageRequest.class)))
                .thenReturn(editedResponse);

        ResponseEntity<MessageResponse> response = messageController.editMessage(
                conversationId,
                "msg-1",
                editRequest,
                authentication
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(editedResponse);
        verify(messageService).editMessage(conversationId, "msg-1", senderId, editRequest);
    }

    @Test
    @DisplayName("REST deleteMessage with FOR_EVERYONE delegates to MessageService and returns 204 No Content")
    void shouldDeleteMessageForEveryone_AndReturnNoContent() {
        when(authentication.getName()).thenReturn(senderId);

        ResponseEntity<Void> response = messageController.deleteMessage(
                conversationId,
                "msg-1",
                MessageDeleteMode.FOR_EVERYONE,
                authentication
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(messageService).deleteMessage(conversationId, "msg-1", senderId, MessageDeleteMode.FOR_EVERYONE);
    }

    @Test
    @DisplayName("REST deleteMessage with FOR_ME delegates to MessageService and returns 204 No Content")
    void shouldDeleteMessageForMe_AndReturnNoContent() {
        when(authentication.getName()).thenReturn(senderId);

        ResponseEntity<Void> response = messageController.deleteMessage(
                conversationId,
                "msg-1",
                MessageDeleteMode.FOR_ME,
                authentication
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(messageService).deleteMessage(conversationId, "msg-1", senderId, MessageDeleteMode.FOR_ME);
    }

    @Test
    @DisplayName("REST markMessageAsRead delegates to MessageService and returns 204 No Content")
    void shouldMarkMessageAsRead_AndReturnNoContent() {
        when(authentication.getName()).thenReturn(senderId);

        ResponseEntity<Void> response = messageController.markMessageAsRead(
                conversationId,
                "msg-1",
                authentication
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(messageService).markMessageAsRead(conversationId, "msg-1", senderId);
    }

    @Test
    @DisplayName("STOMP markStompMessageAsRead delegates to MessageService")
    void shouldMarkStompMessageAsRead() {
        when(principal.getName()).thenReturn(senderId);

        ReadReceiptRequest request = new ReadReceiptRequest("msg-1");
        messageController.markStompMessageAsRead(conversationId, request, principal);

        verify(messageService).markMessageAsRead(conversationId, "msg-1", senderId);
    }
}
