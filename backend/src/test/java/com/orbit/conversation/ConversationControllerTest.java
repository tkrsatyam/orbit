package com.orbit.conversation;

import com.orbit.conversation.dto.ConversationListResponse;
import com.orbit.conversation.dto.ConversationResponse;
import com.orbit.conversation.dto.ParticipantSummary;
import com.orbit.conversation.model.ConversationType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConversationControllerTest {

    @Mock
    private ConversationService conversationService;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private ConversationController conversationController;

    @Test
    @DisplayName("GET /api/v1/conversations returns list of conversations for authenticated user")
    void getConversations_returnsList() {
        when(authentication.getName()).thenReturn("user-me");

        ConversationResponse item = new ConversationResponse(
                "conv-1",
                ConversationType.DIRECT,
                new ParticipantSummary("user-2", "Bob", null, true),
                null,
                null,
                2,
                false
        );
        ConversationListResponse expected = new ConversationListResponse(List.of(item));

        when(conversationService.getConversationsForUser("user-me")).thenReturn(expected);

        ResponseEntity<ConversationListResponse> response = conversationController.getConversations(authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(expected);
    }
}
