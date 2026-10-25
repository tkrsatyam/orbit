package com.orbit.conversation;

import com.orbit.contact.ContactRepository;
import com.orbit.contact.model.Contact;
import com.orbit.contact.model.ContactStatus;
import com.orbit.conversation.dto.ConversationListResponse;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import com.orbit.conversation.model.LastMessageSnapshot;
import com.orbit.group.GroupRepository;
import com.orbit.group.model.Group;
import com.orbit.group.model.GroupMember;
import com.orbit.group.model.GroupRole;
import com.orbit.notification.NotificationRepository;
import com.orbit.notification.model.Notification;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import com.orbit.websocket.WebSocketSessionRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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

    @Mock
    private UserRepository userRepository;

    @Mock
    private GroupRepository groupRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private ContactRepository contactRepository;

    @Mock
    private WebSocketSessionRegistry sessionRegistry;

    private ConversationService conversationService;

    @BeforeEach
    void setUp() {
        conversationService = new ConversationService(
                conversationRepository,
                userRepository,
                groupRepository,
                notificationRepository,
                contactRepository,
                sessionRegistry
        );
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
                .participantIds(List.of("user-1", "user-2"))
                .build();

        when(conversationRepository.findDirectConversationBetween("user-1", "user-2"))
                .thenReturn(Optional.of(existing));

        Conversation result = conversationService.createDirectConversation("user-1", "user-2");

        assertThat(result).isEqualTo(existing);
        verify(conversationRepository, never()).save(any(Conversation.class));
    }

    @Test
    @DisplayName("createDirectConversation throws exception when participant IDs are identical")
    void createDirectConversation_sameUserThrows() {
        assertThatThrownBy(() -> conversationService.createDirectConversation("user-1", "user-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cannot create a direct conversation with oneself");
    }

    @Test
    @DisplayName("createDirectConversation throws exception when any participant ID is blank or null")
    void createDirectConversation_nullOrBlankThrows() {
        assertThatThrownBy(() -> conversationService.createDirectConversation(null, "user-2"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> conversationService.createDirectConversation("user-1", "   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("getConversationsForUser orders conversations by lastMessage sentAt desc and populates unread count and presence")
    void getConversationsForUser_success() {
        Instant now = Instant.now();
        Instant older = now.minusSeconds(60);

        Conversation convDirect = Conversation.builder()
                .id("conv-1")
                .type(ConversationType.DIRECT)
                .participantIds(new ArrayList<>(List.of("user-me", "user-other")))
                .lastMessage(LastMessageSnapshot.builder()
                        .content("Latest DM")
                        .senderId("user-other")
                        .sentAt(now)
                        .build())
                .build();

        Conversation convGroup = Conversation.builder()
                .id("conv-2")
                .type(ConversationType.GROUP)
                .groupId("group-1")
                .participantIds(new ArrayList<>(List.of("user-me", "user-other")))
                .lastMessage(LastMessageSnapshot.builder()
                        .content("Older Group Message")
                        .senderName("Alice")
                        .sentAt(older)
                        .build())
                .build();

        when(conversationRepository.findByParticipantIdsContaining("user-me"))
                .thenReturn(List.of(convGroup, convDirect));

        when(notificationRepository.findByUserIdAndConversationId("user-me", "conv-1"))
                .thenReturn(Optional.of(Notification.builder().count(3).build()));
        when(notificationRepository.findByUserIdAndConversationId("user-me", "conv-2"))
                .thenReturn(Optional.empty());

        when(contactRepository.findBetweenUsers("user-me", "user-other"))
                .thenReturn(Optional.empty());
        when(userRepository.findById("user-other"))
                .thenReturn(Optional.of(User.builder().id("user-other").displayName("Bob").avatarUrl("https://bob.png").online(true).build()));
        when(sessionRegistry.isUserOnline("user-other")).thenReturn(true);

        when(groupRepository.findById("group-1"))
                .thenReturn(Optional.of(Group.builder().id("group-1").name("Tech Group").members(List.of(
                        GroupMember.builder().userId("user-me").role(GroupRole.ADMIN).build(),
                        GroupMember.builder().userId("user-other").role(GroupRole.MEMBER).build()
                )).build()));

        ConversationListResponse response = conversationService.getConversationsForUser("user-me");

        assertThat(response.content()).hasSize(2);
        // Ordered newest first
        assertThat(response.content().get(0).id()).isEqualTo("conv-1");
        assertThat(response.content().get(0).unreadCount()).isEqualTo(3);
        assertThat(response.content().get(0).participant().displayName()).isEqualTo("Bob");
        assertThat(response.content().get(0).participant().online()).isTrue();

        assertThat(response.content().get(1).id()).isEqualTo("conv-2");
        assertThat(response.content().get(1).unreadCount()).isEqualTo(0);
        assertThat(response.content().get(1).group().name()).isEqualTo("Tech Group");
        assertThat(response.content().get(1).group().memberCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("getConversationsForUser masks counterparty details if current user is blocked")
    void getConversationsForUser_masksBlockedUser() {
        Conversation convDirect = Conversation.builder()
                .id("conv-1")
                .type(ConversationType.DIRECT)
                .participantIds(new ArrayList<>(List.of("user-me", "user-blocker")))
                .build();

        when(conversationRepository.findByParticipantIdsContaining("user-me"))
                .thenReturn(List.of(convDirect));
        when(contactRepository.findBetweenUsers("user-me", "user-blocker"))
                .thenReturn(Optional.of(Contact.builder()
                        .status(ContactStatus.BLOCKED)
                        .blockedBy("user-blocker")
                        .build()));

        ConversationListResponse response = conversationService.getConversationsForUser("user-me");

        assertThat(response.content()).hasSize(1);
        assertThat(response.content().get(0).participant().displayName()).isEqualTo("Orbit User");
        assertThat(response.content().get(0).participant().avatarUrl()).isNull();
        assertThat(response.content().get(0).participant().online()).isFalse();
    }
}
