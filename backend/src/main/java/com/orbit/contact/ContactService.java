package com.orbit.contact;

import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.contact.dto.AcceptRequestResponse;
import com.orbit.contact.dto.ConnectionRequestResponse;
import com.orbit.contact.dto.ContactListResponse;
import com.orbit.contact.dto.ContactResponse;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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

    /**
     * Resolves all user IDs with which the specified user has an existing relationship
     * (connected, pending in either direction, or blocked in either direction).
     *
     * @param userId the ID of the user
     * @return a set of user IDs that should be excluded from connection suggestions
     */
    public Set<String> getExcludedUserIdsForSuggestions(String userId) {
        if (userId == null || userId.isBlank()) {
            return Set.of();
        }

        List<Contact> contacts = contactRepository.findAllByUserId(userId);
        Set<String> excluded = new HashSet<>();
        for (Contact contact : contacts) {
            if (userId.equals(contact.getRequesterId())) {
                excluded.add(contact.getReceiverId());
            } else if (userId.equals(contact.getReceiverId())) {
                excluded.add(contact.getRequesterId());
            }
        }
        return excluded;
    }

    /**
     * Retrieves all established contacts for the authenticated user.
     * Enforces P1-11: returns connected contacts with profile info, live online status,
     * and conversationId for direct chat initiation.
     *
     * @param userId the ID of the authenticated user
     * @return ContactListResponse containing the list of established contacts
     */
    public ContactListResponse getContactList(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }

        List<Contact> contacts = contactRepository.findByUserIdAndStatus(userId, ContactStatus.CONNECTED);
        if (contacts.isEmpty()) {
            return new ContactListResponse(new ArrayList<>());
        }

        List<String> otherUserIds = contacts.stream()
                .map(contact -> userId.equals(contact.getRequesterId()) ? contact.getReceiverId() : contact.getRequesterId())
                .toList();

        Map<String, User> userMap = userRepository.findAllById(otherUserIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<ContactResponse> dtos = contacts.stream()
                .map(contact -> {
                    String otherUserId = userId.equals(contact.getRequesterId()) ? contact.getReceiverId() : contact.getRequesterId();
                    User otherUser = userMap.get(otherUserId);

                    String displayName = otherUser != null ? otherUser.getDisplayName() : "Orbit User";
                    String avatarUrl = otherUser != null ? otherUser.getAvatarUrl() : null;
                    String bio = otherUser != null ? otherUser.getBio() : null;
                    boolean online = otherUser != null && otherUser.isOnline();

                    return ContactResponse.builder()
                            .id(contact.getId())
                            .userId(otherUserId)
                            .displayName(displayName)
                            .avatarUrl(avatarUrl)
                            .bio(bio)
                            .online(online)
                            .conversationId(contact.getConversationId())
                            .build();
                })
                .toList();

        return new ContactListResponse(dtos);
    }

    /**
     * Removes an established contact relationship (unfriend).
     * Enforces ADR 006: Hard-deletes the Contact document quietly without storing a
     * REMOVED status. Chat history in Conversation and Message collections is preserved.
     *
     * @param userId the ID of the authenticated user requesting removal
     * @param contactId the contact document ID (or target user ID) to remove
     */
    public void removeContact(String userId, String contactId) {
        if (userId == null || userId.isBlank() || contactId == null || contactId.isBlank()) {
            throw new IllegalArgumentException("User ID and contact ID are required");
        }

        Contact contact = contactRepository.findById(contactId)
                .filter(c -> c.getStatus() == ContactStatus.CONNECTED
                        && (userId.equals(c.getRequesterId()) || userId.equals(c.getReceiverId())))
                .or(() -> contactRepository.findConnectedBetweenUsers(userId, contactId))
                .orElseThrow(() -> new ResourceNotFoundException("Contact not found"));

        contactRepository.delete(contact);
    }

    /**
     * Blocks a target user, establishing a one-directional block relationship per ADR 007 and ADR 013.
     * Works whether or not an existing Contact relationship (PENDING or CONNECTED) exists.
     * If an existing Contact exists in either direction, its status is updated to BLOCKED and blockedBy is set.
     * If no relationship exists, a new Contact document is created directly with status BLOCKED.
     *
     * @param blockerId the ID of the authenticated user initiating the block
     * @param targetUserId the ID of the user to block
     * @throws ResourceNotFoundException if target user does not exist
     * @throws IllegalArgumentException if blockerId is identical to targetUserId or IDs are missing
     */
    public void blockUser(String blockerId, String targetUserId) {
        if (blockerId == null || targetUserId == null || blockerId.isBlank() || targetUserId.isBlank()) {
            throw new IllegalArgumentException("Blocker ID and target user ID are required");
        }

        if (blockerId.equals(targetUserId)) {
            throw new IllegalArgumentException("Cannot block yourself");
        }

        if (!userRepository.existsById(targetUserId)) {
            throw new ResourceNotFoundException("Target user not found: " + targetUserId);
        }

        Optional<Contact> existingOpt = contactRepository.findBetweenUsers(blockerId, targetUserId);
        if (existingOpt.isPresent()) {
            Contact contact = existingOpt.get();
            contact.setStatus(ContactStatus.BLOCKED);
            contact.setBlockedBy(blockerId);
            contactRepository.save(contact);
        } else {
            Contact contact = Contact.builder()
                    .requesterId(blockerId)
                    .receiverId(targetUserId)
                    .status(ContactStatus.BLOCKED)
                    .blockedBy(blockerId)
                    .build();
            contactRepository.save(contact);
        }
    }

    /**
     * Unblocks a target user, permanently hard-deleting the Contact document per ADR 006 and ADR 013.
     * The relationship resets to NONE. If the two users wish to reconnect later, a fresh connection
     * request is required. Conversation documents and message histories are preserved.
     * Operation is idempotent: returns cleanly if no block exists.
     *
     * @param unblockerId the ID of the authenticated user initiating the unblock
     * @param targetUserId the ID of the user to unblock
     * @throws ResourceNotFoundException if target user does not exist
     * @throws IllegalArgumentException if unblockerId is identical to targetUserId or IDs are missing
     */
    public void unblockUser(String unblockerId, String targetUserId) {
        if (unblockerId == null || targetUserId == null || unblockerId.isBlank() || targetUserId.isBlank()) {
            throw new IllegalArgumentException("Unblocker ID and target user ID are required");
        }

        if (unblockerId.equals(targetUserId)) {
            throw new IllegalArgumentException("Cannot unblock yourself");
        }

        if (!userRepository.existsById(targetUserId)) {
            throw new ResourceNotFoundException("Target user not found: " + targetUserId);
        }

        Optional<Contact> existingOpt = contactRepository.findBetweenUsers(unblockerId, targetUserId);
        if (existingOpt.isPresent()) {
            Contact contact = existingOpt.get();
            if (contact.getStatus() == ContactStatus.BLOCKED && unblockerId.equals(contact.getBlockedBy())) {
                contactRepository.delete(contact);
            }
        }
    }
}
