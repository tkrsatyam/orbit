package com.orbit.websocket;

import com.orbit.message.dto.MessageDeletedNotification;
import com.orbit.message.dto.MessageEditedNotification;
import com.orbit.message.dto.MessageResponse;
import com.orbit.message.dto.ReadReceiptNotification;
import com.orbit.message.kafka.MessageDeletedEvent;
import com.orbit.message.kafka.MessageDeliveryEvent;
import com.orbit.message.kafka.MessageEditedEvent;
import com.orbit.message.kafka.MessageReadEvent;
import com.orbit.message.model.MessageDeliveryStatus;
import com.orbit.message.model.MessageType;
import com.orbit.presence.dto.PresenceEvent;
import com.orbit.presence.dto.PresenceNotification;
import com.orbit.presence.dto.TypingEvent;
import com.orbit.presence.dto.TypingNotification;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KafkaWebSocketBridgeTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private WebSocketSessionRegistry sessionRegistry;

    @InjectMocks
    private KafkaWebSocketBridge bridge;

    @Test
    @DisplayName("Should fan out typing event to /topic/conversations/{id}/typing")
    void shouldFanOutTypingEvent() {
        TypingEvent event = new TypingEvent("conv-123", "user-1", "Satyam", true);

        bridge.handlePresenceOrTyping(event);

        ArgumentCaptor<TypingNotification> captor = ArgumentCaptor.forClass(TypingNotification.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/conversations/conv-123/typing"), captor.capture());

        TypingNotification notification = captor.getValue();
        assertThat(notification.userId()).isEqualTo("user-1");
        assertThat(notification.displayName()).isEqualTo("Satyam");
        assertThat(notification.typing()).isTrue();
    }

    @Test
    @DisplayName("Should ignore typing event if event or conversationId is null")
    void shouldIgnoreNullTypingEvent() {
        bridge.handlePresenceOrTyping(null);
        bridge.handlePresenceOrTyping(new TypingEvent(null, "user-1", "Satyam", true));

        verify(messagingTemplate, never()).convertAndSend(any(String.class), any(Object.class));
    }

    @Test
    @DisplayName("Should fan out presence event to /topic/presence/{userId}")
    void shouldFanOutPresenceEvent() {
        Instant now = Instant.now();
        PresenceEvent event = new PresenceEvent("user-1", true, now);

        bridge.handlePresenceOrTyping(event);

        ArgumentCaptor<PresenceNotification> captor = ArgumentCaptor.forClass(PresenceNotification.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/presence/user-1"), captor.capture());

        PresenceNotification notification = captor.getValue();
        assertThat(notification.userId()).isEqualTo("user-1");
        assertThat(notification.online()).isTrue();
        assertThat(notification.lastSeen()).isEqualTo(now);
    }

    @Test
    @DisplayName("Should fan out chat message when local recipient is online")
    void shouldFanOutChatMessageWhenRecipientOnline() {
        Instant now = Instant.now();
        MessageResponse msg = new MessageResponse(
                "msg-1",
                "conv-123",
                "user-1",
                "Satyam",
                MessageType.TEXT,
                "Hello",
                false,
                false,
                null,
                now,
                MessageDeliveryStatus.DELIVERED
        );

        MessageDeliveryEvent event = new MessageDeliveryEvent(
                "msg-1",
                "conv-123",
                "user-1",
                List.of("user-2"),
                msg
        );

        when(sessionRegistry.isOnline("user-2")).thenReturn(true);

        bridge.handleChatMessage(event);

        verify(messagingTemplate).convertAndSend(eq("/topic/conversations/conv-123/messages"), eq(msg));
    }

    @Test
    @DisplayName("Should fan out message edited event")
    void shouldFanOutMessageEditedEvent() {
        Instant now = Instant.now();
        MessageEditedEvent event = new MessageEditedEvent("msg-1", "conv-123", "Updated", now, List.of("user-2"));

        bridge.handleMessageEdited(event);

        ArgumentCaptor<MessageEditedNotification> captor = ArgumentCaptor.forClass(MessageEditedNotification.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/conversations/conv-123/messages/edited"), captor.capture());

        MessageEditedNotification notification = captor.getValue();
        assertThat(notification.messageId()).isEqualTo("msg-1");
        assertThat(notification.content()).isEqualTo("Updated");
        assertThat(notification.editedAt()).isEqualTo(now);
    }

    @Test
    @DisplayName("Should fan out message deleted event")
    void shouldFanOutMessageDeletedEvent() {
        MessageDeletedEvent event = new MessageDeletedEvent("msg-1", "conv-123", List.of("user-2"));

        bridge.handleMessageDeleted(event);

        ArgumentCaptor<MessageDeletedNotification> captor = ArgumentCaptor.forClass(MessageDeletedNotification.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/conversations/conv-123/messages/deleted"), captor.capture());

        MessageDeletedNotification notification = captor.getValue();
        assertThat(notification.messageId()).isEqualTo("msg-1");
    }

    @Test
    @DisplayName("Should fan out message read event to /topic/conversations/{id}/read")
    void shouldFanOutMessageReadEvent() {
        Instant now = Instant.now();
        MessageReadEvent event = new MessageReadEvent("conv-123", "msg-1", "user-2", now);

        bridge.handleMessageRead(event);

        ArgumentCaptor<ReadReceiptNotification> captor = ArgumentCaptor.forClass(ReadReceiptNotification.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/conversations/conv-123/read"), captor.capture());

        ReadReceiptNotification notification = captor.getValue();
        assertThat(notification.messageId()).isEqualTo("msg-1");
        assertThat(notification.userId()).isEqualTo("user-2");
        assertThat(notification.readAt()).isEqualTo(now);
    }
}
