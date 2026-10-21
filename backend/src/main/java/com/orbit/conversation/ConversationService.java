package com.orbit.conversation;

import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Service managing conversation creation, membership, and metadata snapshots.
 * See docs/BACKEND_STRUCTURE.md.
 */
@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;

    public ConversationService(ConversationRepository conversationRepository) {
        this.conversationRepository = conversationRepository;
    }

    /**
     * Creates or retrieves a ready-to-use direct conversation between two users.
     * Called atomically by ContactService upon accepting a connection request.
     *
     * @param user1Id ID of the first participant
     * @param user2Id ID of the second participant
     * @return the created or existing direct Conversation
     */
    public Conversation createDirectConversation(String user1Id, String user2Id) {
        if (user1Id == null || user2Id == null || user1Id.isBlank() || user2Id.isBlank()) {
            throw new IllegalArgumentException("User IDs are required to create a direct conversation");
        }

        if (user1Id.equals(user2Id)) {
            throw new IllegalArgumentException("Cannot create a direct conversation with oneself");
        }

        return conversationRepository.findDirectConversationBetween(user1Id, user2Id)
                .orElseGet(() -> {
                    Conversation conversation = Conversation.builder()
                            .type(ConversationType.DIRECT)
                            .participantIds(new ArrayList<>(List.of(user1Id, user2Id)))
                            .mutedBy(new ArrayList<>())
                            .build();
                    return conversationRepository.save(conversation);
                });
    }
}
