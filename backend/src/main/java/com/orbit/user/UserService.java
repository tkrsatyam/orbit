package com.orbit.user;

import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.user.dto.SelfProfileResponse;
import com.orbit.user.model.User;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
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
}
