package com.orbit.presence;

import com.orbit.contact.ContactService;
import com.orbit.conversation.ConversationRepository;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import com.orbit.message.kafka.KafkaMessageProducer;
import com.orbit.presence.dto.TypingEvent;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PresenceServiceTest {

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ContactService contactService;

    @Mock
    private KafkaMessageProducer kafkaMessageProducer;

    @InjectMocks
    private PresenceService presenceService;

    private Conversation directConversation;
    private Conversation groupConversation;
    private User testUser;

    @BeforeEach
    void setUp() {
        directConversation = Conversation.builder()
                .id("conv-123")
                .type(ConversationType.DIRECT)
                .participantIds(List.of("user-1", "user-2"))
                .build();

        groupConversation = Conversation.builder()
                .id("conv-group")
                .type(ConversationType.GROUP)
                .participantIds(List.of("user-1", "user-2", "user-3"))
                .build();

        testUser = User.builder()
                .id("user-1")
                .displayName("Satyam")
                .build();
    }

    @Nested
    @DisplayName("handleTyping tests")
    class HandleTypingTests {

        @Test
        @DisplayName("Should publish TypingEvent to Kafka when user is participant in direct conversation")
        void shouldPublishTypingEventWhenValidDirectConversation() {
            when(conversationRepository.findById("conv-123")).thenReturn(Optional.of(directConversation));
            when(contactService.isBlockedBy("user-1", "user-2")).thenReturn(false);
            when(userRepository.findById("user-1")).thenReturn(Optional.of(testUser));

            presenceService.handleTyping("conv-123", "user-1", true);

            ArgumentCaptor<TypingEvent> captor = ArgumentCaptor.forClass(TypingEvent.class);
            verify(kafkaMessageProducer).publishTyping(captor.capture());

            TypingEvent captured = captor.getValue();
            assertThat(captured.conversationId()).isEqualTo("conv-123");
            assertThat(captured.userId()).isEqualTo("user-1");
            assertThat(captured.displayName()).isEqualTo("Satyam");
            assertThat(captured.typing()).isTrue();
        }

        @Test
        @DisplayName("Should suppress typing event if recipient in 1:1 conversation blocked typing user")
        void shouldSuppressTypingEventWhenBlockedInDirectConversation() {
            when(conversationRepository.findById("conv-123")).thenReturn(Optional.of(directConversation));
            when(contactService.isBlockedBy("user-1", "user-2")).thenReturn(true);

            presenceService.handleTyping("conv-123", "user-1", true);

            verify(kafkaMessageProducer, never()).publishTyping(any());
            verify(userRepository, never()).findById(any());
        }

        @Test
        @DisplayName("Should NOT suppress typing event in group conversations even if a participant blocked typing user")
        void shouldNotSuppressTypingEventInGroupConversation() {
            when(conversationRepository.findById("conv-group")).thenReturn(Optional.of(groupConversation));
            when(userRepository.findById("user-1")).thenReturn(Optional.of(testUser));

            presenceService.handleTyping("conv-group", "user-1", true);

            ArgumentCaptor<TypingEvent> captor = ArgumentCaptor.forClass(TypingEvent.class);
            verify(kafkaMessageProducer).publishTyping(captor.capture());
            assertThat(captor.getValue().conversationId()).isEqualTo("conv-group");
            assertThat(captor.getValue().typing()).isTrue();
        }

        @Test
        @DisplayName("Should ignore typing event if conversation does not exist")
        void shouldIgnoreWhenConversationNotFound() {
            when(conversationRepository.findById("conv-missing")).thenReturn(Optional.empty());

            presenceService.handleTyping("conv-missing", "user-1", true);

            verify(kafkaMessageProducer, never()).publishTyping(any());
        }

        @Test
        @DisplayName("Should ignore typing event if user is not a participant")
        void shouldIgnoreWhenUserNotParticipant() {
            when(conversationRepository.findById("conv-123")).thenReturn(Optional.of(directConversation));

            presenceService.handleTyping("conv-123", "user-intruder", true);

            verify(kafkaMessageProducer, never()).publishTyping(any());
        }

        @Test
        @DisplayName("Should handle typing: false event correctly")
        void shouldPublishStopTypingEvent() {
            when(conversationRepository.findById("conv-123")).thenReturn(Optional.of(directConversation));
            when(contactService.isBlockedBy("user-1", "user-2")).thenReturn(false);
            when(userRepository.findById("user-1")).thenReturn(Optional.of(testUser));

            presenceService.handleTyping("conv-123", "user-1", false);

            ArgumentCaptor<TypingEvent> captor = ArgumentCaptor.forClass(TypingEvent.class);
            verify(kafkaMessageProducer).publishTyping(captor.capture());
            assertThat(captor.getValue().typing()).isFalse();
        }

        @Test
        @DisplayName("Should fallback to default display name if user not found")
        void shouldFallbackDisplayNameWhenUserNotFound() {
            when(conversationRepository.findById("conv-123")).thenReturn(Optional.of(directConversation));
            when(contactService.isBlockedBy("user-1", "user-2")).thenReturn(false);
            when(userRepository.findById("user-1")).thenReturn(Optional.empty());

            presenceService.handleTyping("conv-123", "user-1", true);

            ArgumentCaptor<TypingEvent> captor = ArgumentCaptor.forClass(TypingEvent.class);
            verify(kafkaMessageProducer).publishTyping(captor.capture());
            assertThat(captor.getValue().displayName()).isEqualTo("Orbit User");
        }

        @Test
        @DisplayName("Should handle null arguments gracefully")
        void shouldHandleNullArgumentsGracefully() {
            presenceService.handleTyping(null, "user-1", true);
            presenceService.handleTyping("conv-123", null, true);

            verify(conversationRepository, never()).findById(any());
            verify(kafkaMessageProducer, never()).publishTyping(any());
        }
    }
}
