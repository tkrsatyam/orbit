package com.orbit.contact;

import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.contact.dto.AcceptRequestResponse;
import com.orbit.contact.dto.ConnectionRequestResponse;
import com.orbit.contact.dto.ContactUserSummaryDto;
import com.orbit.contact.dto.IncomingRequestDto;
import com.orbit.contact.dto.IncomingRequestsResponse;
import com.orbit.contact.dto.RequestAction;
import com.orbit.contact.model.Contact;
import com.orbit.contact.model.ContactStatus;
import com.orbit.conversation.ConversationService;
import com.orbit.conversation.model.Conversation;
import com.orbit.user.UserRepository;
import com.orbit.user.dto.ConnectionStatus;
import com.orbit.user.model.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service managing contact relationships, connection requests, and block checks.
 * Consumed by UserService and MessageService for cross-package relationship checks.
 */
@Service
public class ContactService {

    private final ContactRepository contactRepository;
    private final UserRepository userRepository;
    private final ConversationService conversationService;

    public ContactService(ContactRepository contactRepository,
                          UserRepository userRepository,
                          ConversationService conversationService) {
        this.contactRepository = contactRepository;
        this.userRepository = userRepository;
        this.conversationService = conversationService;
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
     * Retrieves all pending incoming connection requests for the given receiver.
     * Enforces P1-10: returns requests where status is PENDING and receiverId matches.
     *
     * @param receiverId the ID of the authenticated user receiving requests
     * @return the IncomingRequestsResponse containing the list of requests
     */
    public IncomingRequestsResponse getIncomingRequests(String receiverId) {
        if (receiverId == null || receiverId.isBlank()) {
            throw new IllegalArgumentException("Receiver ID is required");
        }

        List<Contact> pending = contactRepository.findByReceiverIdAndStatus(receiverId, ContactStatus.PENDING);
        if (pending.isEmpty()) {
            return new IncomingRequestsResponse(new ArrayList<>());
        }

        List<String> requesterIds = pending.stream().map(Contact::getRequesterId).toList();
        Map<String, User> userMap = userRepository.findAllById(requesterIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<IncomingRequestDto> dtos = pending.stream()
                .map(contact -> {
                    User requester = userMap.get(contact.getRequesterId());
                    ContactUserSummaryDto fromUser = requester != null
                            ? new ContactUserSummaryDto(requester.getId(), requester.getDisplayName(), requester.getAvatarUrl())
                            : new ContactUserSummaryDto(contact.getRequesterId(), "Orbit User", null);

                    return IncomingRequestDto.builder()
                            .id(contact.getId())
                            .fromUser(fromUser)
                            .createdAt(contact.getCreatedAt())
                            .build();
                })
                .toList();

        return new IncomingRequestsResponse(dtos);
    }

    /**
     * Responds to an incoming connection request by either accepting or declining it.
     * Enforces P1-10: Accept establishes relationship and creates direct conversation atomically;
     * Decline hard-deletes the request quietly per ADR 008.
     *
     * @param receiverId the ID of the authenticated user responding to the request
     * @param requestId the ID of the connection request
     * @param action the action to perform: ACCEPT or DECLINE
     * @return AcceptRequestResponse on ACCEPT, or null on DECLINE
     */
    @Transactional
    public AcceptRequestResponse respondToRequest(String receiverId, String requestId, RequestAction action) {
        if (receiverId == null || receiverId.isBlank() || requestId == null || requestId.isBlank() || action == null) {
            throw new IllegalArgumentException("Receiver ID, request ID, and action are required");
        }

        Contact contact = contactRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Connection request not found"));

        if (!receiverId.equals(contact.getReceiverId())) {
            throw new ResourceNotFoundException("Connection request not found");
        }

        if (contact.getStatus() != ContactStatus.PENDING) {
            throw new ConflictException("Connection request is not in PENDING state");
        }

        if (action == RequestAction.DECLINE) {
            contactRepository.delete(contact);
            return null;
        }

        Conversation conversation = conversationService.createDirectConversation(contact.getRequesterId(), contact.getReceiverId());
        contact.setStatus(ContactStatus.CONNECTED);
        contact.setConversationId(conversation.getId());
        contactRepository.save(contact);

        return AcceptRequestResponse.builder()
                .status("ACCEPTED")
                .conversationId(conversation.getId())
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
