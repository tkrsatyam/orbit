package com.orbit.conversation;

import com.orbit.contact.ContactRepository;
import com.orbit.contact.model.ContactStatus;
import com.orbit.conversation.dto.ConversationListResponse;
import com.orbit.conversation.dto.ConversationResponse;
import com.orbit.conversation.dto.GroupSummary;
import com.orbit.conversation.dto.LastMessageResponse;
import com.orbit.conversation.dto.ParticipantSummary;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import com.orbit.group.GroupRepository;
import com.orbit.group.model.Group;
import com.orbit.notification.NotificationRepository;
import com.orbit.notification.model.Notification;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import com.orbit.websocket.WebSocketSessionRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Service managing conversation creation, membership, metadata snapshots,
 * and conversation listing per user (ORDM-51, P1-20).
 * See docs/BACKEND_STRUCTURE.md.
 */
@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final NotificationRepository notificationRepository;
    private final ContactRepository contactRepository;
    private final WebSocketSessionRegistry sessionRegistry;

    @Autowired
    public ConversationService(ConversationRepository conversationRepository,
                               UserRepository userRepository,
                               GroupRepository groupRepository,
                               NotificationRepository notificationRepository,
                               ContactRepository contactRepository,
                               WebSocketSessionRegistry sessionRegistry) {
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.notificationRepository = notificationRepository;
        this.contactRepository = contactRepository;
        this.sessionRegistry = sessionRegistry;
    }

    /**
     * Fallback constructor for isolated tests.
     */
    public ConversationService(ConversationRepository conversationRepository) {
        this(conversationRepository, null, null, null, null, null);
    }

    /**
     * Retrieves all conversations for the authenticated user, ordered by most recent message.
     * Enforces P1-20: Populates participant/group snapshots, unread counts from NotificationRepository,
     * mute status, and suppresses presence/avatar for counterparties who have blocked the user (ADR 007).
     *
     * @param userId authenticated user ID
     * @return ConversationListResponse containing the list of conversation items
     */
    public ConversationListResponse getConversationsForUser(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }

        List<Conversation> conversations = new ArrayList<>(conversationRepository.findByParticipantIdsContaining(userId));

        // Sort descending by lastMessage.sentAt, falling back to createdAt or epoch
        conversations.sort((a, b) -> {
            Instant aTime = a.getLastMessage() != null && a.getLastMessage().getSentAt() != null
                    ? a.getLastMessage().getSentAt() : (a.getCreatedAt() != null ? a.getCreatedAt() : Instant.EPOCH);
            Instant bTime = b.getLastMessage() != null && b.getLastMessage().getSentAt() != null
                    ? b.getLastMessage().getSentAt() : (b.getCreatedAt() != null ? b.getCreatedAt() : Instant.EPOCH);
            return bTime.compareTo(aTime);
        });

        List<ConversationResponse> items = new ArrayList<>(conversations.size());
        for (Conversation conv : conversations) {
            int unreadCount = 0;
            if (notificationRepository != null) {
                unreadCount = notificationRepository.findByUserIdAndConversationId(userId, conv.getId())
                        .map(Notification::getCount)
                        .orElse(0);
            }

            boolean muted = conv.getMutedBy() != null && conv.getMutedBy().contains(userId);

            LastMessageResponse lastMessage = null;
            if (conv.getLastMessage() != null) {
                String senderId = conv.getType() == ConversationType.DIRECT ? conv.getLastMessage().getSenderId() : null;
                String senderDisplayName = conv.getType() == ConversationType.GROUP ? conv.getLastMessage().getSenderName() : null;
                lastMessage = new LastMessageResponse(
                        conv.getLastMessage().getContent(),
                        senderId,
                        senderDisplayName,
                        conv.getLastMessage().getSentAt()
                );
            }

            ParticipantSummary participant = null;
            GroupSummary groupSummary = null;

            if (conv.getType() == ConversationType.DIRECT) {
                String otherUserId = conv.getParticipantIds().stream()
                        .filter(id -> !id.equals(userId))
                        .findFirst()
                        .orElse(null);

                if (otherUserId != null) {
                    boolean isBlocked = isBlockedBy(userId, otherUserId);
                    if (isBlocked) {
                        // Suppressed per ADR 007 Decision 1
                        participant = new ParticipantSummary(otherUserId, "Orbit User", null, false);
                    } else {
                        User otherUser = userRepository != null ? userRepository.findById(otherUserId).orElse(null) : null;
                        String displayName = otherUser != null ? otherUser.getDisplayName() : "Orbit User";
                        String avatarUrl = otherUser != null ? otherUser.getAvatarUrl() : null;
                        boolean isOnline = (sessionRegistry != null && sessionRegistry.isUserOnline(otherUserId))
                                || (otherUser != null && otherUser.isOnline());
                        participant = new ParticipantSummary(otherUserId, displayName, avatarUrl, isOnline);
                    }
                }
            } else if (conv.getType() == ConversationType.GROUP && conv.getGroupId() != null) {
                Group group = groupRepository != null ? groupRepository.findById(conv.getGroupId()).orElse(null) : null;
                if (group != null) {
                    int memberCount = group.getMembers() != null ? group.getMembers().size() : 0;
                    groupSummary = new GroupSummary(group.getId(), group.getName(), group.getAvatarUrl(), memberCount);
                }
            }

            items.add(new ConversationResponse(
                    conv.getId(),
                    conv.getType(),
                    participant,
                    groupSummary,
                    lastMessage,
                    unreadCount,
                    muted
            ));
        }

        return new ConversationListResponse(items);
    }

    private boolean isBlockedBy(String requesterId, String targetUserId) {
        if (contactRepository == null || requesterId == null || targetUserId == null || requesterId.equals(targetUserId)) {
            return false;
        }
        return contactRepository.findBetweenUsers(requesterId, targetUserId)
                .filter(c -> c.getStatus() == ContactStatus.BLOCKED && targetUserId.equals(c.getBlockedBy()))
                .isPresent();
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
