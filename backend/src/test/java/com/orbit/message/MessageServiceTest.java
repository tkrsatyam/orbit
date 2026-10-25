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
import com.orbit.group.GroupRepository;
import com.orbit.group.model.Group;
import com.orbit.group.model.GroupMember;
import com.orbit.group.model.GroupRole;
import com.orbit.message.dto.EditMessageRequest;
import com.orbit.message.dto.MessageHistoryResponse;
import com.orbit.message.dto.MessageResponse;
import com.orbit.message.dto.SendMessageRequest;
import com.orbit.message.kafka.KafkaMessageProducer;
import com.orbit.message.kafka.MessageDeletedEvent;
import com.orbit.message.kafka.MessageDeliveryEvent;
import com.orbit.message.kafka.MessageEditedEvent;
import com.orbit.message.kafka.MessageReadEvent;
import com.orbit.message.model.BlockedMessage;
import com.orbit.message.model.Message;
import com.orbit.message.model.MessageDeleteMode;
import com.orbit.message.model.MessageDeliveryStatus;
import com.orbit.message.model.MessageType;
import com.orbit.message.model.ReadReceipt;
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
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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
    private GroupRepository groupRepository;

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
                groupRepository,
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
        when(messageRepository.findByConversationIdAndNotDeletedForOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
                .thenReturn(List.of(m2, m1));
        when(blockedMessageRepository.findByConversationIdAndSenderIdAndNotDeletedForOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
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

        when(messageRepository.findByConversationIdAndNotDeletedForOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
                .thenReturn(mockMessages);
        when(blockedMessageRepository.findByConversationIdAndSenderIdAndNotDeletedForOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
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

        when(messageRepository.findByConversationIdAndNotDeletedForAndCreatedAtLessThanOrderByCreatedAtDesc(eq(conversationId), eq(senderId), eq(cursorTime), any(Pageable.class)))
                .thenReturn(List.of(olderMsg));
        when(blockedMessageRepository.findByConversationIdAndSenderIdAndNotDeletedForAndCreatedAtLessThanOrderByCreatedAtDesc(eq(conversationId), eq(senderId), eq(cursorTime), any(Pageable.class)))
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

        when(messageRepository.findByConversationIdAndNotDeletedForOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
                .thenReturn(List.of(normal));
        when(blockedMessageRepository.findByConversationIdAndSenderIdAndNotDeletedForOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
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

        when(messageRepository.findByConversationIdAndNotDeletedForOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
                .thenReturn(List.of(deletedMsg));
        when(blockedMessageRepository.findByConversationIdAndSenderIdAndNotDeletedForOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any(Pageable.class)))
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

    // ==========================================
    // ORDM-47: Edit & Delete Message Unit Tests
    // ==========================================

    @Test
    @DisplayName("editMessage successfully edits TEXT message authored by sender and publishes Kafka event")
    void shouldEditMessageSuccessfully_WhenSenderAndTextMessage() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .lastMessage(com.orbit.conversation.model.LastMessageSnapshot.builder()
                        .messageId("msg-edit-1")
                        .content("Original text")
                        .build())
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message original = Message.builder()
                .id("msg-edit-1")
                .conversationId(conversationId)
                .senderId(senderId)
                .content("Original text")
                .type(MessageType.TEXT)
                .deleted(false)
                .edited(false)
                .createdAt(Instant.now().minusSeconds(60))
                .build();
        when(messageRepository.findById("msg-edit-1")).thenReturn(Optional.of(original));
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EditMessageRequest request = new EditMessageRequest("Updated text message");
        MessageResponse response = messageService.editMessage(conversationId, "msg-edit-1", senderId, request);

        assertThat(response.id()).isEqualTo("msg-edit-1");
        assertThat(response.content()).isEqualTo("Updated text message");
        assertThat(response.edited()).isTrue();
        assertThat(response.editedAt()).isNotNull();

        // Verify conversation lastMessage update
        assertThat(conversation.getLastMessage().getContent()).isEqualTo("Updated text message");
        verify(conversationRepository).save(conversation);

        // Verify Kafka event published
        ArgumentCaptor<MessageEditedEvent> eventCaptor = ArgumentCaptor.forClass(MessageEditedEvent.class);
        verify(kafkaMessageProducer).publishMessageEdited(eventCaptor.capture());
        assertThat(eventCaptor.getValue().messageId()).isEqualTo("msg-edit-1");
        assertThat(eventCaptor.getValue().content()).isEqualTo("Updated text message");
        assertThat(eventCaptor.getValue().recipientIds()).containsExactly(recipientId);
    }

    @Test
    @DisplayName("editMessage throws ForbiddenException when non-sender attempts to edit")
    void shouldThrowForbiddenException_WhenNonSenderEditsMessage() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message original = Message.builder()
                .id("msg-edit-2")
                .conversationId(conversationId)
                .senderId(senderId)
                .content("Original text")
                .type(MessageType.TEXT)
                .build();
        when(messageRepository.findById("msg-edit-2")).thenReturn(Optional.of(original));

        EditMessageRequest request = new EditMessageRequest("Hacked edit");
        assertThatThrownBy(() -> messageService.editMessage(conversationId, "msg-edit-2", recipientId, request))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("only edit your own messages");

        verify(kafkaMessageProducer, never()).publishMessageEdited(any());
    }

    @Test
    @DisplayName("editMessage throws IllegalArgumentException when editing deleted message")
    void shouldThrowIllegalArgumentException_WhenEditingDeletedMessage() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message deleted = Message.builder()
                .id("msg-del-1")
                .conversationId(conversationId)
                .senderId(senderId)
                .deleted(true)
                .content(null)
                .type(MessageType.TEXT)
                .build();
        when(messageRepository.findById("msg-del-1")).thenReturn(Optional.of(deleted));

        EditMessageRequest request = new EditMessageRequest("Revived edit");
        assertThatThrownBy(() -> messageService.editMessage(conversationId, "msg-del-1", senderId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cannot edit a deleted message");
    }

    @Test
    @DisplayName("editMessage throws IllegalArgumentException when editing non-TEXT message")
    void shouldThrowIllegalArgumentException_WhenEditingNonTextMessage() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message imageMsg = Message.builder()
                .id("msg-img-1")
                .conversationId(conversationId)
                .senderId(senderId)
                .deleted(false)
                .type(MessageType.IMAGE)
                .build();
        when(messageRepository.findById("msg-img-1")).thenReturn(Optional.of(imageMsg));

        EditMessageRequest request = new EditMessageRequest("Image caption edit");
        assertThatThrownBy(() -> messageService.editMessage(conversationId, "msg-img-1", senderId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only TEXT messages can be edited");
    }

    @Test
    @DisplayName("editMessage edits diverted message in blockedMessages collection with no Kafka publish")
    void shouldEditBlockedMessage_WithNoKafkaPublish() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(messageRepository.findById("blocked-msg-1")).thenReturn(Optional.empty());

        BlockedMessage blocked = BlockedMessage.builder()
                .id("blocked-msg-1")
                .conversationId(conversationId)
                .senderId(senderId)
                .type(MessageType.TEXT)
                .content("Blocked original")
                .deleted(false)
                .build();
        when(blockedMessageRepository.findById("blocked-msg-1")).thenReturn(Optional.of(blocked));
        when(blockedMessageRepository.save(any(BlockedMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EditMessageRequest request = new EditMessageRequest("Blocked edited text");
        MessageResponse response = messageService.editMessage(conversationId, "blocked-msg-1", senderId, request);

        assertThat(response.id()).isEqualTo("blocked-msg-1");
        assertThat(response.content()).isEqualTo("Blocked edited text");
        assertThat(response.deliveryStatus()).isEqualTo(MessageDeliveryStatus.SENT);
        verify(kafkaMessageProducer, never()).publishMessageEdited(any());
    }

    @Test
    @DisplayName("deleteMessage with FOR_EVERYONE soft-deletes message and publishes Kafka delete event")
    void shouldDeleteMessageForEveryone_WhenSender() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .lastMessage(com.orbit.conversation.model.LastMessageSnapshot.builder()
                        .messageId("msg-del-2")
                        .content("Last message content")
                        .build())
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message message = Message.builder()
                .id("msg-del-2")
                .conversationId(conversationId)
                .senderId(senderId)
                .content("Message to delete")
                .deleted(false)
                .build();
        when(messageRepository.findById("msg-del-2")).thenReturn(Optional.of(message));

        messageService.deleteMessage(conversationId, "msg-del-2", senderId, MessageDeleteMode.FOR_EVERYONE);

        assertThat(message.isDeleted()).isTrue();
        assertThat(message.getContent()).isNull();
        verify(messageRepository).save(message);

        assertThat(conversation.getLastMessage().getContent()).isEqualTo("This message was deleted");
        verify(conversationRepository).save(conversation);

        ArgumentCaptor<MessageDeletedEvent> eventCaptor = ArgumentCaptor.forClass(MessageDeletedEvent.class);
        verify(kafkaMessageProducer).publishMessageDeleted(eventCaptor.capture());
        assertThat(eventCaptor.getValue().messageId()).isEqualTo("msg-del-2");
        assertThat(eventCaptor.getValue().recipientIds()).containsExactly(recipientId);
    }

    @Test
    @DisplayName("deleteMessage with FOR_EVERYONE succeeds when caller is group admin in group conversation")
    void shouldDeleteMessageForEveryone_WhenGroupAdmin() {
        String groupId = "group-1";
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.GROUP)
                .groupId(groupId)
                .participantIds(List.of(senderId, recipientId, "admin-user"))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Group group = Group.builder()
                .id(groupId)
                .members(List.of(
                        GroupMember.builder().userId("admin-user").role(GroupRole.ADMIN).build(),
                        GroupMember.builder().userId(senderId).role(GroupRole.MEMBER).build()
                ))
                .build();
        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));

        Message memberMsg = Message.builder()
                .id("msg-member")
                .conversationId(conversationId)
                .senderId(senderId)
                .content("Spam message")
                .deleted(false)
                .build();
        when(messageRepository.findById("msg-member")).thenReturn(Optional.of(memberMsg));

        messageService.deleteMessage(conversationId, "msg-member", "admin-user", MessageDeleteMode.FOR_EVERYONE);

        assertThat(memberMsg.isDeleted()).isTrue();
        assertThat(memberMsg.getContent()).isNull();
        verify(messageRepository).save(memberMsg);
        verify(kafkaMessageProducer).publishMessageDeleted(any());
    }

    @Test
    @DisplayName("deleteMessage with FOR_EVERYONE throws ForbiddenException when non-sender and non-admin")
    void shouldThrowForbiddenException_WhenNonSenderAndNonAdminDeletesForEveryone() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message message = Message.builder()
                .id("msg-target")
                .conversationId(conversationId)
                .senderId(senderId)
                .content("Target message")
                .build();
        when(messageRepository.findById("msg-target")).thenReturn(Optional.of(message));

        assertThatThrownBy(() -> messageService.deleteMessage(conversationId, "msg-target", recipientId, MessageDeleteMode.FOR_EVERYONE))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("only delete your own messages for everyone");

        verify(kafkaMessageProducer, never()).publishMessageDeleted(any());
    }

    @Test
    @DisplayName("deleteMessage with FOR_ME appends user ID to deletedFor and decrements unread count for recipient")
    void shouldDeleteMessageForMe_AndDecrementUnreadCount() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message message = Message.builder()
                .id("msg-for-me")
                .conversationId(conversationId)
                .senderId(senderId)
                .content("Message for me delete")
                .deletedFor(new ArrayList<>())
                .build();
        when(messageRepository.findById("msg-for-me")).thenReturn(Optional.of(message));

        messageService.deleteMessage(conversationId, "msg-for-me", recipientId, MessageDeleteMode.FOR_ME);

        assertThat(message.getDeletedFor()).containsExactly(recipientId);
        assertThat(message.isDeleted()).isFalse(); // Not deleted globally
        verify(messageRepository).save(message);
        verify(notificationRepository).decrementUnreadCount(recipientId, conversationId);
        verify(kafkaMessageProducer, never()).publishMessageDeleted(any());
    }

    @Test
    @DisplayName("deleteMessage with FOR_ME appends user ID to deletedFor on BlockedMessage")
    void shouldDeleteBlockedMessageForMe() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(messageRepository.findById("blocked-del-1")).thenReturn(Optional.empty());

        BlockedMessage blocked = BlockedMessage.builder()
                .id("blocked-del-1")
                .conversationId(conversationId)
                .senderId(senderId)
                .deletedFor(new ArrayList<>())
                .build();
        when(blockedMessageRepository.findById("blocked-del-1")).thenReturn(Optional.of(blocked));

        messageService.deleteMessage(conversationId, "blocked-del-1", senderId, MessageDeleteMode.FOR_ME);

        assertThat(blocked.getDeletedFor()).containsExactly(senderId);
        verify(blockedMessageRepository).save(blocked);
        verify(kafkaMessageProducer, never()).publishMessageDeleted(any());
    }

    @Test
    @DisplayName("markMessageAsRead adds recipient to readBy, marks notification read, and publishes Kafka event")
    void markMessageAsRead_success() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message message = Message.builder()
                .id("msg-read-1")
                .conversationId(conversationId)
                .senderId(senderId)
                .readBy(new ArrayList<>())
                .build();
        when(messageRepository.findById("msg-read-1")).thenReturn(Optional.of(message));

        messageService.markMessageAsRead(conversationId, "msg-read-1", recipientId);

        assertThat(message.getReadBy()).hasSize(1);
        assertThat(message.getReadBy().get(0).getUserId()).isEqualTo(recipientId);
        verify(messageRepository).save(message);
        verify(notificationRepository).markConversationAsRead(recipientId, conversationId);

        ArgumentCaptor<MessageReadEvent> captor = ArgumentCaptor.forClass(MessageReadEvent.class);
        verify(kafkaMessageProducer).publishMessageRead(captor.capture());
        assertThat(captor.getValue().conversationId()).isEqualTo(conversationId);
        assertThat(captor.getValue().messageId()).isEqualTo("msg-read-1");
        assertThat(captor.getValue().userId()).isEqualTo(recipientId);
    }

    @Test
    @DisplayName("markMessageAsRead is idempotent when user already read the message")
    void markMessageAsRead_idempotent() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message message = Message.builder()
                .id("msg-read-1")
                .conversationId(conversationId)
                .senderId(senderId)
                .readBy(new ArrayList<>(List.of(new ReadReceipt(recipientId, Instant.now()))))
                .build();
        when(messageRepository.findById("msg-read-1")).thenReturn(Optional.of(message));

        messageService.markMessageAsRead(conversationId, "msg-read-1", recipientId);

        assertThat(message.getReadBy()).hasSize(1);
        verify(messageRepository, never()).save(any());
        verify(kafkaMessageProducer, never()).publishMessageRead(any());
        verify(notificationRepository).markConversationAsRead(recipientId, conversationId);
    }

    @Test
    @DisplayName("markMessageAsRead ignores call if user is the sender")
    void markMessageAsRead_senderIgnored() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message message = Message.builder()
                .id("msg-read-1")
                .conversationId(conversationId)
                .senderId(senderId)
                .readBy(new ArrayList<>())
                .build();
        when(messageRepository.findById("msg-read-1")).thenReturn(Optional.of(message));

        messageService.markMessageAsRead(conversationId, "msg-read-1", senderId);

        assertThat(message.getReadBy()).isEmpty();
        verify(messageRepository, never()).save(any());
        verify(kafkaMessageProducer, never()).publishMessageRead(any());
    }

    @Test
    @DisplayName("markMessageAsRead throws ForbiddenException if user is not a participant")
    void markMessageAsRead_nonParticipantThrows() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.DIRECT)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        assertThatThrownBy(() -> messageService.markMessageAsRead(conversationId, "msg-read-1", "user-stranger"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("sendMessage in GROUP conversation bypasses block check, updates lastMessage, notifies all group members, and publishes to Kafka (P1-28)")
    void sendMessage_WhenGroupConversation_BypassesBlockCheckAndNotifiesAllRecipients() {
        when(rateLimiter.tryConsume(anyString(), anyInt())).thenReturn(ConsumptionResult.success());
        String recipient2 = "user-member-3";
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.GROUP)
                .groupId("group-test-1")
                .participantIds(List.of(senderId, recipientId, recipient2))
                .build();

        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(
                User.builder().id(senderId).displayName("Alice Builder").build()
        ));

        Message savedMsg = Message.builder()
                .id("msg-group-1")
                .conversationId(conversationId)
                .senderId(senderId)
                .senderName("Alice Builder")
                .type(MessageType.TEXT)
                .content("Welcome to group discussion!")
                .createdAt(Instant.now())
                .build();
        when(messageRepository.save(any(Message.class))).thenReturn(savedMsg);

        SendMessageRequest request = new SendMessageRequest("Welcome to group discussion!", MessageType.TEXT, "idemp-group-1");
        MessageResponse response = messageService.sendMessage(conversationId, senderId, request);

        assertThat(response.id()).isEqualTo("msg-group-1");
        assertThat(response.content()).isEqualTo("Welcome to group discussion!");
        assertThat(response.senderName()).isEqualTo("Alice Builder");

        // Divergence from 1:1: Block check is strictly bypassed for GROUP conversations (ADR 007)
        verify(contactService, never()).isBlockedBy(any(), any());

        // Notifications incremented in bulk for all recipients except sender (O(1) round-trip)
        verify(notificationRepository).incrementUnreadCounts(argThat(list -> list.containsAll(List.of(recipientId, recipient2)) && list.size() == 2), eq(conversationId));
        verify(notificationRepository, never()).incrementUnreadCount(anyString(), anyString());

        // Kafka fan-out published with all group recipients
        ArgumentCaptor<com.orbit.message.kafka.MessageDeliveryEvent> captor = ArgumentCaptor.forClass(com.orbit.message.kafka.MessageDeliveryEvent.class);
        verify(kafkaMessageProducer).publishMessage(captor.capture());
        com.orbit.message.kafka.MessageDeliveryEvent publishedEvent = captor.getValue();
        assertThat(publishedEvent.conversationId()).isEqualTo(conversationId);
        assertThat(publishedEvent.senderId()).isEqualTo(senderId);
        assertThat(publishedEvent.recipientIds()).containsExactlyInAnyOrder(recipientId, recipient2);

        // Conversation snapshot updated
        verify(conversationRepository).save(conversation);
        assertThat(conversation.getLastMessage()).isNotNull();
        assertThat(conversation.getLastMessage().getContent()).isEqualTo("Welcome to group discussion!");
        assertThat(conversation.getLastMessage().getSenderName()).isEqualTo("Alice Builder");
    }

    @Test
    @DisplayName("getConversationMessages in GROUP conversation returns messages in chronological order with cursor (P1-29)")
    void getConversationMessages_WhenGroupConversation_ReturnsChronologicalMessages() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .type(ConversationType.GROUP)
                .groupId("group-test-1")
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Instant now = Instant.now();
        Message msg1 = Message.builder().id("msg-g1").conversationId(conversationId).senderId(senderId).senderName("Alice").content("First").createdAt(now.minusSeconds(10)).build();
        Message msg2 = Message.builder().id("msg-g2").conversationId(conversationId).senderId(recipientId).senderName("Bob").content("Second").createdAt(now.minusSeconds(5)).build();

        when(messageRepository.findByConversationIdAndNotDeletedForOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any()))
                .thenReturn(List.of(msg2, msg1));
        when(blockedMessageRepository.findByConversationIdAndSenderIdAndNotDeletedForOrderByCreatedAtDesc(eq(conversationId), eq(senderId), any()))
                .thenReturn(List.of());

        MessageHistoryResponse history = messageService.getConversationMessages(conversationId, senderId, 50, null);

        assertThat(history.content()).hasSize(2);
        // Returned in chronological order (oldest first)
        assertThat(history.content().get(0).id()).isEqualTo("msg-g1");
        assertThat(history.content().get(1).id()).isEqualTo("msg-g2");
        assertThat(history.hasMore()).isFalse();
    }

    @Test
    @DisplayName("markMessagesAsRead marks multiple messages in bulk and publishes read events")
    void markMessagesAsRead_MarksAllAndPublishesEvents() {
        Conversation conversation = Conversation.builder()
                .id(conversationId)
                .participantIds(List.of(senderId, recipientId))
                .build();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));

        Message msg1 = Message.builder()
                .id("m1")
                .conversationId(conversationId)
                .senderId(recipientId)
                .readBy(new ArrayList<>())
                .build();
        Message msg2 = Message.builder()
                .id("m2")
                .conversationId(conversationId)
                .senderId(recipientId)
                .readBy(new ArrayList<>())
                .build();
        when(messageRepository.findAllById(List.of("m1", "m2"))).thenReturn(List.of(msg1, msg2));

        messageService.markMessagesAsRead(conversationId, List.of("m1", "m2"), senderId);

        verify(notificationRepository).markConversationAsRead(senderId, conversationId);
        verify(messageRepository).save(msg1);
        verify(messageRepository).save(msg2);
        verify(kafkaMessageProducer, times(2)).publishMessageRead(any());
    }
}
