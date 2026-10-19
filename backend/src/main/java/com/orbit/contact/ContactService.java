package com.orbit.contact;

import com.orbit.contact.model.Contact;
import com.orbit.contact.model.ContactStatus;
import com.orbit.user.dto.ConnectionStatus;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service managing contact relationships, connection requests, and block checks.
 * Consumed by UserService and MessageService for cross-package relationship checks.
 */
@Service
public class ContactService {

    private final ContactRepository contactRepository;

    public ContactService(ContactRepository contactRepository) {
        this.contactRepository = contactRepository;
    }

    /**
     * Determines whether the requester is blocked by the target user.
     *
     * @param requesterId the ID of the user initiating the request
     * @param targetUserId the ID of the target user
     * @return true if target user has blocked requester, false otherwise
     */
    public boolean isBlockedBy(String requesterId, String targetUserId) {
        if (requesterId == null || targetUserId == null || requesterId.equals(targetUserId)) {
            return false;
        }

        return contactRepository.findBetweenUsers(requesterId, targetUserId)
                .filter(contact -> contact.getStatus() == ContactStatus.BLOCKED
                        && targetUserId.equals(contact.getBlockedBy()))
                .isPresent();
    }

    /**
     * Resolves the contact relationship status from the requester's perspective.
     *
     * @param requesterId the ID of the user requesting the relationship status
     * @param targetUserId the ID of the target user
     * @return the resolved ConnectionStatus
     */
    public ConnectionStatus getConnectionStatus(String requesterId, String targetUserId) {
        if (requesterId == null || targetUserId == null || requesterId.equals(targetUserId)) {
            return ConnectionStatus.NONE;
        }

        Optional<Contact> relationshipOpt = contactRepository.findBetweenUsers(requesterId, targetUserId);
        if (relationshipOpt.isEmpty()) {
            return ConnectionStatus.NONE;
        }

        Contact contact = relationshipOpt.get();
        if (contact.getStatus() == null) {
            return ConnectionStatus.NONE;
        }

        return switch (contact.getStatus()) {
            case CONNECTED -> ConnectionStatus.CONNECTED;
            case PENDING -> requesterId.equals(contact.getRequesterId())
                    ? ConnectionStatus.PENDING_SENT
                    : ConnectionStatus.PENDING_RECEIVED;
            case BLOCKED -> requesterId.equals(contact.getBlockedBy())
                    ? ConnectionStatus.BLOCKED
                    : ConnectionStatus.NONE;
        };
    }
}
