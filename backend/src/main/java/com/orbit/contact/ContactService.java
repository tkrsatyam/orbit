package com.orbit.contact;

import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.contact.dto.ConnectionRequestResponse;
import com.orbit.contact.dto.ContactUserSummaryDto;
import com.orbit.contact.model.Contact;
import com.orbit.contact.model.ContactStatus;
import com.orbit.user.UserRepository;
import com.orbit.user.dto.ConnectionStatus;
import com.orbit.user.model.User;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service managing contact relationships, connection requests, and block checks.
 * Consumed by UserService and MessageService for cross-package relationship checks.
 */
@Service
public class ContactService {

    private final ContactRepository contactRepository;
    private final UserRepository userRepository;

    public ContactService(ContactRepository contactRepository, UserRepository userRepository) {
        this.contactRepository = contactRepository;
        this.userRepository = userRepository;
    }

    /**
     * Sends an outbound connection request to a target user.
     * Enforces P1-09: prevents self-requests, requests to non-existent users,
     * blocked relationships, and duplicate or existing connections.
     *
     * @param requesterId the ID of the authenticated user sending the request
     * @param targetUserId the ID of the user receiving the request
     * @return the created ConnectionRequestResponse
     */
    public ConnectionRequestResponse sendRequest(String requesterId, String targetUserId) {
        if (requesterId == null || targetUserId == null || requesterId.isBlank() || targetUserId.isBlank()) {
            throw new IllegalArgumentException("Requester ID and target user ID are required");
        }

        if (requesterId.equals(targetUserId)) {
            throw new IllegalArgumentException("Cannot send a connection request to yourself");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Target user not found"));

        Optional<Contact> existingOpt = contactRepository.findBetweenUsers(requesterId, targetUserId);
        if (existingOpt.isPresent()) {
            Contact existing = existingOpt.get();
            if (existing.getStatus() == ContactStatus.CONNECTED) {
                throw new ConflictException("You are already connected with this user");
            } else if (existing.getStatus() == ContactStatus.BLOCKED) {
                throw new ConflictException("Unable to send connection request to this user");
            } else if (existing.getStatus() == ContactStatus.PENDING) {
                if (requesterId.equals(existing.getRequesterId())) {
                    throw new ConflictException("A connection request has already been sent to this user");
                } else {
                    throw new ConflictException("This user has already sent you a connection request. Please accept or decline it.");
                }
            }
        }

        Contact contact = Contact.builder()
                .requesterId(requesterId)
                .receiverId(targetUserId)
                .status(ContactStatus.PENDING)
                .build();

        Contact saved = contactRepository.save(contact);

        return ConnectionRequestResponse.builder()
                .id(saved.getId())
                .status(saved.getStatus())
                .toUser(new ContactUserSummaryDto(targetUser.getId(), targetUser.getDisplayName(), targetUser.getAvatarUrl()))
                .createdAt(saved.getCreatedAt())
                .build();
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
