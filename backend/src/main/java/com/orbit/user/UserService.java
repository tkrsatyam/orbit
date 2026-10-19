package com.orbit.user;

import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.contact.ContactService;
import com.orbit.user.dto.ConnectionStatus;
import com.orbit.user.dto.SelfProfileResponse;
import com.orbit.user.dto.UserProfileResponse;
import com.orbit.user.model.User;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final ContactService contactService;

    public UserService(UserRepository userRepository, ContactService contactService) {
        this.userRepository = userRepository;
        this.contactService = contactService;
    }

    /**
     * Retrieves the authenticated user's self profile.
     *
     * @param userId the ID of the authenticated user
     * @return the user's self profile
     * @throws ResourceNotFoundException if user does not exist
     */
    public SelfProfileResponse getSelfProfile(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ResourceNotFoundException("User not found");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        return SelfProfileResponse.from(user);
    }

    /**
     * Retrieves the public profile of another user from the perspective of the requester.
     * If the requester is blocked by the target user, degrades asymmetrically to { id, available: false }.
     * If the target user does not exist, throws ResourceNotFoundException.
     *
     * @param targetUserId ID of the user whose profile is being viewed
     * @param requesterUserId ID of the authenticated user making the request
     * @return the UserProfileResponse (normal or degraded)
     * @throws ResourceNotFoundException if target user does not exist
     */
    public UserProfileResponse getUserProfile(String targetUserId, String requesterUserId) {
        if (targetUserId == null || targetUserId.isBlank()) {
            throw new ResourceNotFoundException("User not found");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + targetUserId));

        if (requesterUserId != null && contactService.isBlockedBy(requesterUserId, targetUserId)) {
            return UserProfileResponse.unavailable(targetUserId);
        }

        ConnectionStatus connectionStatus = (requesterUserId != null)
                ? contactService.getConnectionStatus(requesterUserId, targetUserId)
                : ConnectionStatus.NONE;

        return UserProfileResponse.of(targetUser, connectionStatus);
    }
}
