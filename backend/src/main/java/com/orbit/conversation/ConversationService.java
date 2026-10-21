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

    /**
     * Creates a ready-to-use group conversation for a newly created group.
     * Called atomically by GroupService upon group creation.
     *
     * @param creatorId ID of the creator/initial admin
     * @param groupId ID of the associated group document
     * @return the created group Conversation
     */
    public Conversation createGroupConversation(String creatorId, String groupId) {
        if (creatorId == null || creatorId.isBlank()) {
            throw new IllegalArgumentException("Creator ID is required to create a group conversation");
        }
        if (groupId == null || groupId.isBlank()) {
            throw new IllegalArgumentException("Group ID is required to create a group conversation");
        }

        Conversation conversation = Conversation.builder()
                .type(ConversationType.GROUP)
                .groupId(groupId)
                .participantIds(new ArrayList<>(List.of(creatorId)))
                .mutedBy(new ArrayList<>())
                .build();
        return conversationRepository.save(conversation);
    }

    /**
     * Adds a participant to a group conversation upon joining.
     *
     * @param conversationId ID of the group conversation
     * @param userId ID of the joining user
     */
    public void addGroupParticipant(String conversationId, String userId) {
        if (conversationId == null || userId == null || conversationId.isBlank() || userId.isBlank()) {
            throw new IllegalArgumentException("Conversation ID and User ID are required");
        }
        conversationRepository.findById(conversationId).ifPresent(conv -> {
            if (!conv.getParticipantIds().contains(userId)) {
                conv.getParticipantIds().add(userId);
                conversationRepository.save(conv);
            }
        });
    }

    /**
     * Removes a participant from a group conversation upon leaving or eviction.
     *
     * @param conversationId ID of the group conversation
     * @param userId ID of the departing user
     */
    public void removeGroupParticipant(String conversationId, String userId) {
        if (conversationId == null || userId == null || conversationId.isBlank() || userId.isBlank()) {
            throw new IllegalArgumentException("Conversation ID and User ID are required");
        }
        conversationRepository.findById(conversationId).ifPresent(conv -> {
            conv.getParticipantIds().remove(userId);
            conversationRepository.save(conv);
        });
    }

    /**
     * Deletes a group conversation upon group deletion.
     *
     * @param conversationId ID of the group conversation
     */
    public void deleteGroupConversation(String conversationId) {
        if (conversationId != null && !conversationId.isBlank()) {
            conversationRepository.deleteById(conversationId);
        }
    }
}
