package com.orbit.message;

import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.ForbiddenException;
import com.orbit.common.exception.RateLimitException;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.common.ratelimit.ConsumptionResult;
import com.orbit.common.ratelimit.TokenBucketRateLimiter;
import com.orbit.contact.ContactService;
import com.orbit.conversation.ConversationRepository;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import com.orbit.message.dto.MessageHistoryResponse;
import com.orbit.message.dto.MessageResponse;
import com.orbit.message.dto.SendMessageRequest;
import com.orbit.message.kafka.KafkaMessageProducer;
import com.orbit.message.kafka.MessageDeliveryEvent;
import com.orbit.message.model.BlockedMessage;
import com.orbit.message.model.Message;
import com.orbit.message.model.MessageDeliveryStatus;
import com.orbit.message.model.MessageType;
import com.orbit.notification.NotificationRepository;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private BlockedMessageRepository blockedMessageRepository;

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private ContactService contactService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private KafkaMessageProducer kafkaMessageProducer;

    @Mock
    private TokenBucketRateLimiter rateLimiter;

    @Mock
    private OrbitProperties properties;

    @Mock
    private OrbitProperties.RateLimit rateLimitConfig;

    private MessageService messageService;

    private final String conversationId = "conv-123";
    private final String senderId = "user-sender";
    private final String recipientId = "user-recipient";

    @BeforeEach
    void setUp() {
        lenient().when(properties.rateLimit()).thenReturn(rateLimitConfig);
        lenient().when(rateLimitConfig.messagesPerMinute()).thenReturn(60);

        messageService = new MessageService(
                messageRepository,
                blockedMessageRepository,
                conversationRepository,
                notificationRepository,
                contactService,
                userRepository,
                kafkaMessageProducer,
                rateLimiter,
                properties
        );
    }

    @Test
    @DisplayName("Successfully sends 1:1 message, updates lastMessage, upserts notification, and publishes to Kafka")
    void shouldSendMessageSuccessfully_WhenNormal1on1Conversation() {
        when(rateLimiter.tryConsume(anyString(), anyInt())).thenReturn(ConsumptionResult.success());

        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(new ArrayList<>(List.of(senderId, recipientId)))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        User sender = User.builder().id(senderId).displayName("Satyam Kumar").build();
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));

        when(contactService.isBlockedBy(senderId, recipientId)).thenReturn(false);

        Message savedMessage = Message.builder()
                .id("msg-001")
                .conversationId(conversationId)
                .senderId(senderId)
                .senderName("Satyam Kumar")
                .type(MessageType.TEXT)
                .content("Hello World")
                .createdAt(Instant.now())
                .build();
        when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

        SendMessageRequest request = new SendMessageRequest("Hello World", MessageType.TEXT, "idemp-key-1");
        MessageResponse response = messageService.sendMessage(conversationId, senderId, request);

        assertThat(response.id()).isEqualTo("msg-001");
        assertThat(response.content()).isEqualTo("Hello World");
        assertThat(response.senderName()).isEqualTo("Satyam Kumar");

        // Verify persist-before-publish order
        verify(messageRepository).save(any(Message.class));
        verify(conversationRepository).save(conversation);
        assertThat(conversation.getLastMessage()).isNotNull();
        assertThat(conversation.getLastMessage().getContent()).isEqualTo("Hello World");

        verify(notificationRepository).incrementUnreadCount(recipientId, conversationId);

        ArgumentCaptor<MessageDeliveryEvent> eventCaptor = ArgumentCaptor.forClass(MessageDeliveryEvent.class);
        verify(kafkaMessageProducer).publishMessage(eventCaptor.capture());
        MessageDeliveryEvent capturedEvent = eventCaptor.getValue();
        assertThat(capturedEvent.messageId()).isEqualTo("msg-001");
        assertThat(capturedEvent.recipientIds()).containsExactly(recipientId);

        // Verify blocked repository was NOT touched
        verify(blockedMessageRepository, never()).save(any());
    }

    @Test
    @DisplayName("Diverts message to blockedMessages collection when sender is blocked (ADR 007)")
    void shouldDivertMessageToBlockedMessages_WhenSenderIsBlocked() {
        when(rateLimiter.tryConsume(anyString(), anyInt())).thenReturn(ConsumptionResult.success());

        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(new ArrayList<>(List.of(senderId, recipientId)))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        User sender = User.builder().id(senderId).displayName("Blocked User").build();
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));

        when(contactService.isBlockedBy(senderId, recipientId)).thenReturn(true);

        BlockedMessage savedBlocked = BlockedMessage.builder()
                .id("bmsg-001")
                .conversationId(conversationId)
                .senderId(senderId)
                .senderName("Blocked User")
                .type(MessageType.TEXT)
                .content("I am blocked")
                .createdAt(Instant.now())
                .build();
        when(blockedMessageRepository.save(any(BlockedMessage.class))).thenReturn(savedBlocked);

        SendMessageRequest request = new SendMessageRequest("I am blocked", MessageType.TEXT, null);
        MessageResponse response = messageService.sendMessage(conversationId, senderId, request);

        assertThat(response.id()).isEqualTo("bmsg-001");
        assertThat(response.content()).isEqualTo("I am blocked");

        // Verify blockedMessages saved
        verify(blockedMessageRepository).save(any(BlockedMessage.class));

        // Verify normal messages, lastMessage, notifications, and Kafka are SKIPPED
        verify(messageRepository, never()).save(any());
        verify(conversationRepository, never()).save(any());
        verify(notificationRepository, never()).incrementUnreadCount(anyString(), anyString());
        verify(kafkaMessageProducer, never()).publishMessage(any());
    }

    @Test
    @DisplayName("Returns existing message when duplicate idempotency key is submitted")
    void shouldReturnExistingMessage_WhenIdempotencyKeyAlreadyExists() {
        when(rateLimiter.tryConsume(anyString(), anyInt())).thenReturn(ConsumptionResult.success());

        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(new ArrayList<>(List.of(senderId, recipientId)))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message existing = Message.builder()
                .id("msg-existing")
                .conversationId(conversationId)
                .senderId(senderId)
                .senderName("Satyam")
                .content("Original message")
                .idempotencyKey("uuid-1234")
                .createdAt(Instant.now())
                .build();
        when(messageRepository.findByConversationIdAndIdempotencyKey(conversationId, "uuid-1234"))
                .thenReturn(Optional.of(existing));

        SendMessageRequest request = new SendMessageRequest("Original message", MessageType.TEXT, "uuid-1234");
        MessageResponse response = messageService.sendMessage(conversationId, senderId, request);

        assertThat(response.id()).isEqualTo("msg-existing");
        assertThat(response.content()).isEqualTo("Original message");

        verify(messageRepository, never()).save(any());
        verify(kafkaMessageProducer, never()).publishMessage(any());
    }

    @Test
    @DisplayName("Throws ForbiddenException when sender is not a conversation participant")
    void shouldThrowForbiddenException_WhenSenderIsNotParticipant() {
        when(rateLimiter.tryConsume(anyString(), anyInt())).thenReturn(ConsumptionResult.success());

        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of("user-other-1", "user-other-2"))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        SendMessageRequest request = new SendMessageRequest("Intruder message");

        assertThatThrownBy(() -> messageService.sendMessage(conversationId, senderId, request))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("not a participant");
    }

    @Test
    @DisplayName("Throws ResourceNotFoundException when conversation does not exist")
    void shouldThrowResourceNotFoundException_WhenConversationDoesNotExist() {
        when(rateLimiter.tryConsume(anyString(), anyInt())).thenReturn(ConsumptionResult.success());
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.empty());

        SendMessageRequest request = new SendMessageRequest("Hello");

        assertThatThrownBy(() -> messageService.sendMessage(conversationId, senderId, request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Conversation not found");
    }

    @Test
    @DisplayName("Throws RateLimitException when user message rate limit is exceeded")
    void shouldThrowRateLimitException_WhenRateLimitExceeded() {
        when(rateLimiter.tryConsume(anyString(), anyInt())).thenReturn(ConsumptionResult.rejected(45));

        SendMessageRequest request = new SendMessageRequest("Spam message");

        assertThatThrownBy(() -> messageService.sendMessage(conversationId, senderId, request))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("rate limit exceeded");

        verify(conversationRepository, never()).findById(anyString());
    }

    @Test
    @DisplayName("getConversationMessages returns messages in chronological order with default size 50")
    void shouldReturnMessagesInChronologicalOrder_DefaultSize50() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Instant t1 = Instant.parse("2026-10-24T10:00:00Z");
        Instant t2 = Instant.parse("2026-10-24T10:05:00Z");

        Message m1 = Message.builder().id("m1").conversationId(conversationId).senderId(senderId).content("Hello").createdAt(t1).build();
        Message m2 = Message.builder().id("m2").conversationId(conversationId).senderId(recipientId).content("Hi").createdAt(t2).build();

        // Repository returns newest first (t2 then t1)
        when(messageRepository.findByConversationIdOrderByCreatedAtDesc(eq(conversationId), any(Pageable.class)))
                .thenReturn(List.of(m2, m1));
        when(blockedMessageRepository.findByConversationIdAndSenderIdOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
                .thenReturn(List.of());

        MessageHistoryResponse response = messageService.getConversationMessages(conversationId, senderId, null, null);

        assertThat(response.hasMore()).isFalse();
        assertThat(response.nextCursor()).isNull();
        // Chronological order: m1 then m2
        assertThat(response.content()).hasSize(2);
        assertThat(response.content().get(0).id()).isEqualTo("m1");
        assertThat(response.content().get(1).id()).isEqualTo("m2");
    }

    @Test
    @DisplayName("getConversationMessages clamps size to 100 and computes hasMore and nextCursor")
    void shouldClampSizeTo100_AndComputeHasMoreAndNextCursor() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        List<Message> mockMessages = new ArrayList<>();
        Instant baseTime = Instant.parse("2026-10-24T10:00:00Z");
        for (int i = 101; i >= 1; i--) {
            mockMessages.add(Message.builder()
                    .id("msg-" + i)
                    .conversationId(conversationId)
                    .senderId(senderId)
                    .content("Msg " + i)
                    .createdAt(baseTime.plusSeconds(i))
                    .build());
        }

        when(messageRepository.findByConversationIdOrderByCreatedAtDesc(eq(conversationId), any(Pageable.class)))
                .thenReturn(mockMessages);
        when(blockedMessageRepository.findByConversationIdAndSenderIdOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
                .thenReturn(List.of());

        // Request with size 150 (should clamp to 100)
        MessageHistoryResponse response = messageService.getConversationMessages(conversationId, senderId, 150, null);

        assertThat(response.hasMore()).isTrue();
        assertThat(response.content()).hasSize(100);
        // Oldest item in the sliced 100 batch is msg-2 (since 101 was the newest and 1 was 101st)
        assertThat(response.nextCursor()).isEqualTo("msg-2");
        assertThat(response.content().get(0).id()).isEqualTo("msg-2");
        assertThat(response.content().get(99).id()).isEqualTo("msg-101");
    }

    @Test
    @DisplayName("getConversationMessages resolves before cursor and queries older messages")
    void shouldResolveBeforeCursor_AndQueryOlderMessages() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Instant cursorTime = Instant.parse("2026-10-24T10:10:00Z");
        Message cursorMsg = Message.builder()
                .id("msg-cursor")
                .conversationId(conversationId)
                .createdAt(cursorTime)
                .build();
        when(messageRepository.findById("msg-cursor")).thenReturn(Optional.of(cursorMsg));

        Instant t0 = Instant.parse("2026-10-24T10:00:00Z");
        Message olderMsg = Message.builder()
                .id("msg-older")
                .conversationId(conversationId)
                .senderId(recipientId)
                .content("Older message")
                .createdAt(t0)
                .build();

        when(messageRepository.findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc(eq(conversationId), eq(cursorTime), any(Pageable.class)))
                .thenReturn(List.of(olderMsg));
        when(blockedMessageRepository.findByConversationIdAndSenderIdAndCreatedAtLessThanOrderByCreatedAtDesc(eq(conversationId), eq(senderId), eq(cursorTime), any(Pageable.class)))
                .thenReturn(List.of());

        MessageHistoryResponse response = messageService.getConversationMessages(conversationId, senderId, 20, "msg-cursor");

        assertThat(response.hasMore()).isFalse();
        assertThat(response.content()).hasSize(1);
        assertThat(response.content().get(0).id()).isEqualTo("msg-older");
    }

    @Test
    @DisplayName("getConversationMessages merges blocked messages for sender per ADR 007")
    void shouldMergeBlockedMessages_ForSender() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Instant t1 = Instant.parse("2026-10-24T10:00:00Z");
        Instant t2 = Instant.parse("2026-10-24T10:02:00Z");

        Message normal = Message.builder().id("m1").conversationId(conversationId).senderId(recipientId).content("Normal").createdAt(t1).build();
        BlockedMessage blocked = BlockedMessage.builder().id("b1").conversationId(conversationId).senderId(senderId).content("Blocked attempt").createdAt(t2).build();

        when(messageRepository.findByConversationIdOrderByCreatedAtDesc(eq(conversationId), any(Pageable.class)))
                .thenReturn(List.of(normal));
        when(blockedMessageRepository.findByConversationIdAndSenderIdOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
                .thenReturn(List.of(blocked));

        MessageHistoryResponse response = messageService.getConversationMessages(conversationId, senderId, 50, null);

        assertThat(response.content()).hasSize(2);
        // Chronological: normal (t1) then blocked (t2)
        assertThat(response.content().get(0).id()).isEqualTo("m1");
        assertThat(response.content().get(0).deliveryStatus()).isEqualTo(MessageDeliveryStatus.DELIVERED);
        assertThat(response.content().get(1).id()).isEqualTo("b1");
        assertThat(response.content().get(1).deliveryStatus()).isEqualTo(MessageDeliveryStatus.SENT);
    }

    @Test
    @DisplayName("getConversationMessages masks content when message is soft deleted")
    void shouldMaskContent_WhenMessageIsSoftDeleted() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message deletedMsg = Message.builder()
                .id("m-del")
                .conversationId(conversationId)
                .senderId(senderId)
                .content("Secret text")
                .deleted(true)
                .createdAt(Instant.now())
                .build();

        when(messageRepository.findByConversationIdOrderByCreatedAtDesc(eq(conversationId), any(Pageable.class)))
                .thenReturn(List.of(deletedMsg));
        when(blockedMessageRepository.findByConversationIdAndSenderIdOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
                .thenReturn(List.of());

        MessageHistoryResponse response = messageService.getConversationMessages(conversationId, senderId, 50, null);

        assertThat(response.content()).hasSize(1);
        assertThat(response.content().get(0).deleted()).isTrue();
        assertThat(response.content().get(0).content()).isNull();
    }

    @Test
    @DisplayName("getConversationMessages throws ForbiddenException when user is not a participant")
    void shouldThrowForbiddenException_WhenGettingMessagesAsNonParticipant() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of("other-user-1", "other-user-2"))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        assertThatThrownBy(() -> messageService.getConversationMessages(conversationId, senderId, 50, null))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("not a participant");
    }

    @Test
    @DisplayName("getConversationMessages throws ResourceNotFoundException when cursor message is not found")
    void shouldThrowResourceNotFoundException_WhenCursorMessageNotFound() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(messageRepository.findById("missing-cursor")).thenReturn(Optional.empty());
        when(blockedMessageRepository.findById("missing-cursor")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.getConversationMessages(conversationId, senderId, 50, "missing-cursor"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Cursor message not found");
    }
}
