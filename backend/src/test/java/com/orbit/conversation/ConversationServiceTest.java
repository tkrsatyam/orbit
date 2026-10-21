package com.orbit.conversation;

import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {

    @Mock
    private ConversationRepository conversationRepository;

    private ConversationService conversationService;

    @BeforeEach
    void setUp() {
        conversationService = new ConversationService(conversationRepository);
    }

    @Test
    @DisplayName("createDirectConversation creates new DIRECT conversation when none exists")
    void createDirectConversation_createsNew() {
        when(conversationRepository.findDirectConversationBetween("user-1", "user-2"))
                .thenReturn(Optional.empty());

        when(conversationRepository.save(any(Conversation.class)))
                .thenAnswer(inv -> {
                    Conversation c = inv.getArgument(0);
                    c.setId("conv-123");
                    return c;
                });

        Conversation result = conversationService.createDirectConversation("user-1", "user-2");

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo("conv-123");
        assertThat(result.getType()).isEqualTo(ConversationType.DIRECT);
        assertThat(result.getParticipantIds()).containsExactly("user-1", "user-2");
        verify(conversationRepository).save(any(Conversation.class));
    }

    @Test
    @DisplayName("createDirectConversation returns existing direct conversation when present")
    void createDirectConversation_returnsExisting() {
        Conversation existing = Conversation.builder()
                .id("conv-existing")
                .type(ConversationType.DIRECT)
                .build();

        when(conversationRepository.findDirectConversationBetween("user-1", "user-2"))
                .thenReturn(Optional.of(existing));

        Conversation result = conversationService.createDirectConversation("user-1", "user-2");

        assertThat(result).isSameAs(existing);
        verify(conversationRepository, never()).save(any(Conversation.class));
    }

    @Test
    @DisplayName("createDirectConversation throws IllegalArgumentException when users are identical")
    void createDirectConversation_sameUserThrows() {
        assertThatThrownBy(() -> conversationService.createDirectConversation("user-1", "user-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cannot create a direct conversation with oneself");
    }

    @Test
    @DisplayName("createDirectConversation throws IllegalArgumentException on null or blank user IDs")
    void createDirectConversation_nullOrBlankThrows() {
        assertThatThrownBy(() -> conversationService.createDirectConversation(null, "user-2"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> conversationService.createDirectConversation("user-1", "   "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
