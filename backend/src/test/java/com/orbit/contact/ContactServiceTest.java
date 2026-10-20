package com.orbit.contact;

import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.contact.dto.ConnectionRequestResponse;
import com.orbit.contact.model.Contact;
import com.orbit.contact.model.ContactStatus;
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

    private ContactService contactService;

    @BeforeEach
    void setUp() {
        contactService = new ContactService(contactRepository, userRepository);
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
}
