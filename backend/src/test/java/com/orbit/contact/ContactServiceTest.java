package com.orbit.contact;

import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.contact.dto.AcceptRequestResponse;
import com.orbit.contact.dto.ConnectionRequestResponse;
import com.orbit.contact.dto.ContactListResponse;
import com.orbit.contact.dto.ContactResponse;
import com.orbit.contact.dto.IncomingRequestsResponse;
import com.orbit.contact.dto.RequestAction;
import com.orbit.contact.model.Contact;
import com.orbit.contact.model.ContactStatus;
import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import com.orbit.user.UserRepository;
import com.orbit.user.dto.ConnectionStatus;
import com.orbit.user.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContactServiceTest {

    @Mock
    private ContactRepository contactRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private com.orbit.conversation.ConversationService conversationService;

    private ContactService contactService;

    @BeforeEach
    void setUp() {
        contactService = new ContactService(contactRepository, userRepository, conversationService);
    }

    @Test
    void sendRequestSucceedsWhenValidTargetAndNoPriorRelationship() {
        User targetUser = User.builder()
                .id("target-123")
                .displayName("Priya Sharma")
                .avatarUrl("https://pub-xxx.r2.dev/avatars/priya.jpg")
                .build();

        when(userRepository.findById("target-123")).thenReturn(Optional.of(targetUser));
        when(contactRepository.findBetweenUsers("req-123", "target-123")).thenReturn(Optional.empty());

        Instant now = Instant.now();
        Contact savedContact = Contact.builder()
                .id("contact-999")
                .requesterId("req-123")
                .receiverId("target-123")
                .status(ContactStatus.PENDING)
                .createdAt(now)
                .build();
        when(contactRepository.save(any(Contact.class))).thenReturn(savedContact);

        ConnectionRequestResponse response = contactService.sendRequest("req-123", "target-123");

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo("contact-999");
        assertThat(response.getStatus()).isEqualTo(ContactStatus.PENDING);
        assertThat(response.getToUser().getId()).isEqualTo("target-123");
        assertThat(response.getToUser().getDisplayName()).isEqualTo("Priya Sharma");
        assertThat(response.getToUser().getAvatarUrl()).isEqualTo("https://pub-xxx.r2.dev/avatars/priya.jpg");
        assertThat(response.getCreatedAt()).isEqualTo(now);

        ArgumentCaptor<Contact> captor = ArgumentCaptor.forClass(Contact.class);
        verify(contactRepository).save(captor.capture());
        assertThat(captor.getValue().getRequesterId()).isEqualTo("req-123");
        assertThat(captor.getValue().getReceiverId()).isEqualTo("target-123");
        assertThat(captor.getValue().getStatus()).isEqualTo(ContactStatus.PENDING);
    }

    @Test
    void sendRequestThrowsExceptionWhenRequesterEqualsTarget() {
        assertThatThrownBy(() -> contactService.sendRequest("user-1", "user-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cannot send a connection request to yourself");
    }

    @Test
    void sendRequestThrowsExceptionWhenIdsBlankOrNull() {
        assertThatThrownBy(() -> contactService.sendRequest(null, "user-2"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> contactService.sendRequest("user-1", ""))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sendRequestThrowsNotFoundWhenTargetDoesNotExist() {
        when(userRepository.findById("missing-user")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> contactService.sendRequest("user-1", "missing-user"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Target user not found");
    }

    @Test
    void sendRequestThrowsConflictWhenAlreadyConnected() {
        User targetUser = User.builder().id("target-123").displayName("Rahul").build();
        when(userRepository.findById("target-123")).thenReturn(Optional.of(targetUser));

        Contact connected = Contact.builder()
                .requesterId("user-1")
                .receiverId("target-123")
                .status(ContactStatus.CONNECTED)
                .build();
        when(contactRepository.findBetweenUsers("user-1", "target-123")).thenReturn(Optional.of(connected));

        assertThatThrownBy(() -> contactService.sendRequest("user-1", "target-123"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("You are already connected with this user");
    }

    @Test
    void sendRequestThrowsConflictWhenBlocked() {
        User targetUser = User.builder().id("target-123").displayName("Rahul").build();
        when(userRepository.findById("target-123")).thenReturn(Optional.of(targetUser));

        Contact blocked = Contact.builder()
                .requesterId("user-1")
                .receiverId("target-123")
                .status(ContactStatus.BLOCKED)
                .blockedBy("target-123")
                .build();
        when(contactRepository.findBetweenUsers("user-1", "target-123")).thenReturn(Optional.of(blocked));

        assertThatThrownBy(() -> contactService.sendRequest("user-1", "target-123"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Unable to send connection request to this user");
    }

    @Test
    void sendRequestThrowsConflictWhenRequestAlreadySentByRequester() {
        User targetUser = User.builder().id("target-123").displayName("Rahul").build();
        when(userRepository.findById("target-123")).thenReturn(Optional.of(targetUser));

        Contact pending = Contact.builder()
                .requesterId("user-1")
                .receiverId("target-123")
                .status(ContactStatus.PENDING)
                .build();
        when(contactRepository.findBetweenUsers("user-1", "target-123")).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> contactService.sendRequest("user-1", "target-123"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("A connection request has already been sent to this user");
    }

    @Test
    void sendRequestThrowsConflictWhenRequestAlreadyReceivedFromTarget() {
        User targetUser = User.builder().id("target-123").displayName("Rahul").build();
        when(userRepository.findById("target-123")).thenReturn(Optional.of(targetUser));

        Contact pending = Contact.builder()
                .requesterId("target-123")
                .receiverId("user-1")
                .status(ContactStatus.PENDING)
                .build();
        when(contactRepository.findBetweenUsers("user-1", "target-123")).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> contactService.sendRequest("user-1", "target-123"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("This user has already sent you a connection request");
    }

    @Test
    void isBlockedByReturnsFalseForNullOrSameIds() {
        assertThat(contactService.isBlockedBy(null, "user2")).isFalse();
        assertThat(contactService.isBlockedBy("user1", null)).isFalse();
        assertThat(contactService.isBlockedBy("user1", "user1")).isFalse();
    }

    @Test
    void isBlockedByReturnsFalseWhenNoContactExists() {
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.empty());

        assertThat(contactService.isBlockedBy("user1", "user2")).isFalse();
    }

    @Test
    void isBlockedByReturnsFalseWhenConnectedOrPending() {
        Contact connected = Contact.builder()
                .requesterId("user1")
                .receiverId("user2")
                .status(ContactStatus.CONNECTED)
                .build();
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.of(connected));

        assertThat(contactService.isBlockedBy("user1", "user2")).isFalse();

        Contact pending = Contact.builder()
                .requesterId("user1")
                .receiverId("user2")
                .status(ContactStatus.PENDING)
                .build();
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.of(pending));

        assertThat(contactService.isBlockedBy("user1", "user2")).isFalse();
    }

    @Test
    void isBlockedByReturnsFalseWhenRequesterIsTheBlocker() {
        Contact blocked = Contact.builder()
                .requesterId("user1")
                .receiverId("user2")
                .status(ContactStatus.BLOCKED)
                .blockedBy("user1")
                .build();
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.of(blocked));

        assertThat(contactService.isBlockedBy("user1", "user2")).isFalse();
    }

    @Test
    void isBlockedByReturnsTrueWhenTargetUserIsTheBlocker() {
        Contact blocked = Contact.builder()
                .requesterId("user1")
                .receiverId("user2")
                .status(ContactStatus.BLOCKED)
                .blockedBy("user2")
                .build();
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.of(blocked));

        assertThat(contactService.isBlockedBy("user1", "user2")).isTrue();
    }

    @Test
    void getConnectionStatusReturnsNoneForNullOrSameIds() {
        assertThat(contactService.getConnectionStatus(null, "user2")).isEqualTo(ConnectionStatus.NONE);
        assertThat(contactService.getConnectionStatus("user1", null)).isEqualTo(ConnectionStatus.NONE);
        assertThat(contactService.getConnectionStatus("user1", "user1")).isEqualTo(ConnectionStatus.NONE);
    }

    @Test
    void getConnectionStatusReturnsNoneWhenNoRelationshipFound() {
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.empty());

        assertThat(contactService.getConnectionStatus("user1", "user2")).isEqualTo(ConnectionStatus.NONE);
    }

    @Test
    void getConnectionStatusReturnsConnected() {
        Contact contact = Contact.builder()
                .requesterId("user1")
                .receiverId("user2")
                .status(ContactStatus.CONNECTED)
                .build();
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.of(contact));

        assertThat(contactService.getConnectionStatus("user1", "user2")).isEqualTo(ConnectionStatus.CONNECTED);
    }

    @Test
    void getConnectionStatusReturnsPendingSentWhenRequesterInitiated() {
        Contact contact = Contact.builder()
                .requesterId("user1")
                .receiverId("user2")
                .status(ContactStatus.PENDING)
                .build();
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.of(contact));

        assertThat(contactService.getConnectionStatus("user1", "user2")).isEqualTo(ConnectionStatus.PENDING_SENT);
    }

    @Test
    void getConnectionStatusReturnsPendingReceivedWhenTargetInitiated() {
        Contact contact = Contact.builder()
                .requesterId("user2")
                .receiverId("user1")
                .status(ContactStatus.PENDING)
                .build();
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.of(contact));

        assertThat(contactService.getConnectionStatus("user1", "user2")).isEqualTo(ConnectionStatus.PENDING_RECEIVED);
    }

    @Test
    void getConnectionStatusReturnsBlockedWhenRequesterIsBlocker() {
        Contact contact = Contact.builder()
                .requesterId("user1")
                .receiverId("user2")
                .status(ContactStatus.BLOCKED)
                .blockedBy("user1")
                .build();
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.of(contact));

        assertThat(contactService.getConnectionStatus("user1", "user2")).isEqualTo(ConnectionStatus.BLOCKED);
    }

    @Test
    void getConnectionStatusReturnsNoneWhenRequesterIsBlockedParty() {
        Contact contact = Contact.builder()
                .requesterId("user1")
                .receiverId("user2")
                .status(ContactStatus.BLOCKED)
                .blockedBy("user2")
                .build();
        when(contactRepository.findBetweenUsers("user1", "user2")).thenReturn(Optional.of(contact));

        assertThat(contactService.getConnectionStatus("user1", "user2")).isEqualTo(ConnectionStatus.NONE);
    }

    @Test
    void getIncomingRequestsReturnsMappedDtos() {
        Contact c1 = Contact.builder()
                .id("req-1")
                .requesterId("user-alice")
                .receiverId("user-bob")
                .status(ContactStatus.PENDING)
                .createdAt(Instant.parse("2026-10-21T00:00:00Z"))
                .build();

        User alice = User.builder()
                .id("user-alice")
                .displayName("Alice")
                .avatarUrl("https://example.com/alice.png")
                .build();

        when(contactRepository.findByReceiverIdAndStatus("user-bob", ContactStatus.PENDING))
                .thenReturn(java.util.List.of(c1));
        when(userRepository.findAllById(java.util.List.of("user-alice")))
                .thenReturn(java.util.List.of(alice));

        IncomingRequestsResponse response = contactService.getIncomingRequests("user-bob");

        assertThat(response).isNotNull();
        assertThat(response.getContent()).hasSize(1);
        assertThat(response.getContent().get(0).getId()).isEqualTo("req-1");
        assertThat(response.getContent().get(0).getFromUser().getDisplayName()).isEqualTo("Alice");
        assertThat(response.getContent().get(0).getFromUser().getAvatarUrl()).isEqualTo("https://example.com/alice.png");
    }

    @Test
    void getIncomingRequestsThrowsOnNullOrBlankReceiver() {
        assertThatThrownBy(() -> contactService.getIncomingRequests(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> contactService.getIncomingRequests("  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void respondToRequestAcceptsAndCreatesConversationAtomically() {
        Contact contact = Contact.builder()
                .id("req-10")
                .requesterId("user-alice")
                .receiverId("user-bob")
                .status(ContactStatus.PENDING)
                .build();

        when(contactRepository.findById("req-10")).thenReturn(Optional.of(contact));

        Conversation mockConv = Conversation.builder()
                .id("conv-99")
                .type(ConversationType.DIRECT)
                .build();
        when(conversationService.createDirectConversation("user-alice", "user-bob"))
                .thenReturn(mockConv);

        AcceptRequestResponse response = contactService.respondToRequest("user-bob", "req-10", RequestAction.ACCEPT);

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo("ACCEPTED");
        assertThat(response.getConversationId()).isEqualTo("conv-99");

        assertThat(contact.getStatus()).isEqualTo(ContactStatus.CONNECTED);
        assertThat(contact.getConversationId()).isEqualTo("conv-99");
        verify(contactRepository).save(contact);
    }

    @Test
    void respondToRequestDeclineHardDeletesContactDocument() {
        Contact contact = Contact.builder()
                .id("req-11")
                .requesterId("user-alice")
                .receiverId("user-bob")
                .status(ContactStatus.PENDING)
                .build();

        when(contactRepository.findById("req-11")).thenReturn(Optional.of(contact));

        AcceptRequestResponse response = contactService.respondToRequest("user-bob", "req-11", RequestAction.DECLINE);

        assertThat(response).isNull();
        verify(contactRepository).delete(contact);
    }

    @Test
    void respondToRequestThrowsNotFoundWhenRequestDoesNotExist() {
        when(contactRepository.findById("non-existent")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> contactService.respondToRequest("user-bob", "non-existent", RequestAction.ACCEPT))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Connection request not found");
    }

    @Test
    void respondToRequestThrowsNotFoundWhenUserIsNotReceiver() {
        Contact contact = Contact.builder()
                .id("req-12")
                .requesterId("user-alice")
                .receiverId("user-charlie")
                .status(ContactStatus.PENDING)
                .build();

        when(contactRepository.findById("req-12")).thenReturn(Optional.of(contact));

        assertThatThrownBy(() -> contactService.respondToRequest("user-bob", "req-12", RequestAction.ACCEPT))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Connection request not found");
    }

    @Test
    void respondToRequestThrowsConflictWhenNotPending() {
        Contact contact = Contact.builder()
                .id("req-13")
                .requesterId("user-alice")
                .receiverId("user-bob")
                .status(ContactStatus.CONNECTED)
                .build();

        when(contactRepository.findById("req-13")).thenReturn(Optional.of(contact));

        assertThatThrownBy(() -> contactService.respondToRequest("user-bob", "req-13", RequestAction.ACCEPT))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Connection request is not in PENDING state");
    }

    @Test
    void respondToRequestThrowsIllegalArgumentOnNullInputs() {
        assertThatThrownBy(() -> contactService.respondToRequest(null, "req-1", RequestAction.ACCEPT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> contactService.respondToRequest("user-bob", null, RequestAction.ACCEPT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> contactService.respondToRequest("user-bob", "req-1", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void getContactListReturnsConnectedContactsWithProfileAndPresence() {
        String authUserId = "auth-user";
        Contact contact1 = Contact.builder()
                .id("contact-1")
                .requesterId(authUserId)
                .receiverId("peer-1")
                .status(ContactStatus.CONNECTED)
                .conversationId("conv-1")
                .build();
        Contact contact2 = Contact.builder()
                .id("contact-2")
                .requesterId("peer-2")
                .receiverId(authUserId)
                .status(ContactStatus.CONNECTED)
                .conversationId("conv-2")
                .build();

        when(contactRepository.findByUserIdAndStatus(authUserId, ContactStatus.CONNECTED))
                .thenReturn(java.util.List.of(contact1, contact2));

        User peer1 = User.builder()
                .id("peer-1")
                .displayName("Vikram K")
                .avatarUrl("https://example.com/avatar1.jpg")
                .bio("Java builder")
                .online(true)
                .build();
        User peer2 = User.builder()
                .id("peer-2")
                .displayName("Sneha K")
                .avatarUrl(null)
                .bio("Angular prepper")
                .online(false)
                .build();

        when(userRepository.findAllById(java.util.List.of("peer-1", "peer-2")))
                .thenReturn(java.util.List.of(peer1, peer2));

        ContactListResponse response = contactService.getContactList(authUserId);

        assertThat(response).isNotNull();
        assertThat(response.getContent()).hasSize(2);

        ContactResponse item1 = response.getContent().get(0);
        assertThat(item1.getId()).isEqualTo("contact-1");
        assertThat(item1.getUserId()).isEqualTo("peer-1");
        assertThat(item1.getDisplayName()).isEqualTo("Vikram K");
        assertThat(item1.getAvatarUrl()).isEqualTo("https://example.com/avatar1.jpg");
        assertThat(item1.getBio()).isEqualTo("Java builder");
        assertThat(item1.isOnline()).isTrue();
        assertThat(item1.getConversationId()).isEqualTo("conv-1");

        ContactResponse item2 = response.getContent().get(1);
        assertThat(item2.getId()).isEqualTo("contact-2");
        assertThat(item2.getUserId()).isEqualTo("peer-2");
        assertThat(item2.getDisplayName()).isEqualTo("Sneha K");
        assertThat(item2.isOnline()).isFalse();
        assertThat(item2.getConversationId()).isEqualTo("conv-2");
    }

    @Test
    void getContactListReturnsEmptyWhenNoContactsExist() {
        when(contactRepository.findByUserIdAndStatus("user-none", ContactStatus.CONNECTED))
                .thenReturn(java.util.List.of());

        ContactListResponse response = contactService.getContactList("user-none");

        assertThat(response).isNotNull();
        assertThat(response.getContent()).isEmpty();
    }

    @Test
    void getContactListThrowsIllegalArgumentOnNullOrBlankUserId() {
        assertThatThrownBy(() -> contactService.getContactList(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> contactService.getContactList("   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void removeContactSucceedsWhenFoundByIdAndConnected() {
        String authUserId = "auth-user";
        Contact contact = Contact.builder()
                .id("contact-100")
                .requesterId(authUserId)
                .receiverId("peer-1")
                .status(ContactStatus.CONNECTED)
                .conversationId("conv-1")
                .build();

        when(contactRepository.findById("contact-100")).thenReturn(Optional.of(contact));

        contactService.removeContact(authUserId, "contact-100");

        verify(contactRepository).delete(contact);
    }

    @Test
    void removeContactSucceedsWhenFoundViaTargetUserIdFallback() {
        String authUserId = "auth-user";
        String targetUserId = "peer-2";
        Contact contact = Contact.builder()
                .id("contact-200")
                .requesterId(targetUserId)
                .receiverId(authUserId)
                .status(ContactStatus.CONNECTED)
                .conversationId("conv-2")
                .build();

        when(contactRepository.findById(targetUserId)).thenReturn(Optional.empty());
        when(contactRepository.findConnectedBetweenUsers(authUserId, targetUserId))
                .thenReturn(Optional.of(contact));

        contactService.removeContact(authUserId, targetUserId);

        verify(contactRepository).delete(contact);
    }

    @Test
    void removeContactThrowsNotFoundWhenContactNotConnected() {
        String authUserId = "auth-user";
        Contact contact = Contact.builder()
                .id("contact-300")
                .requesterId(authUserId)
                .receiverId("peer-3")
                .status(ContactStatus.PENDING)
                .build();

        when(contactRepository.findById("contact-300")).thenReturn(Optional.of(contact));
        when(contactRepository.findConnectedBetweenUsers(authUserId, "contact-300")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> contactService.removeContact(authUserId, "contact-300"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Contact not found");
    }

    @Test
    void removeContactThrowsNotFoundWhenUserIsNotParticipant() {
        String authUserId = "auth-user";
        Contact contact = Contact.builder()
                .id("contact-400")
                .requesterId("user-x")
                .receiverId("user-y")
                .status(ContactStatus.CONNECTED)
                .build();

        when(contactRepository.findById("contact-400")).thenReturn(Optional.of(contact));
        when(contactRepository.findConnectedBetweenUsers(authUserId, "contact-400")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> contactService.removeContact(authUserId, "contact-400"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Contact not found");
    }

    @Test
    void removeContactThrowsNotFoundWhenContactDoesNotExist() {
        when(contactRepository.findById("missing-id")).thenReturn(Optional.empty());
        when(contactRepository.findConnectedBetweenUsers("auth-user", "missing-id")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> contactService.removeContact("auth-user", "missing-id"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Contact not found");
    }

    @Test
    void removeContactThrowsIllegalArgumentOnNullOrBlankArguments() {
        assertThatThrownBy(() -> contactService.removeContact(null, "contact-1"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> contactService.removeContact("user-1", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> contactService.removeContact("   ", "contact-1"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> contactService.removeContact("user-1", "   "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
