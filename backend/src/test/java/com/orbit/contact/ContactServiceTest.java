package com.orbit.contact;

import com.orbit.contact.model.Contact;
import com.orbit.contact.model.ContactStatus;
import com.orbit.user.dto.ConnectionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContactServiceTest {

    @Mock
    private ContactRepository contactRepository;

    private ContactService contactService;

    @BeforeEach
    void setUp() {
        contactService = new ContactService(contactRepository);
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
