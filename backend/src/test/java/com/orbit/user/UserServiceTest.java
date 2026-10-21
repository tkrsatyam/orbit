package com.orbit.user;

import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.contact.ContactService;
import com.orbit.user.dto.ConnectionStatus;
import com.orbit.user.dto.SelfProfileResponse;
import com.orbit.user.dto.UserProfileResponse;
import com.orbit.user.model.User;
import com.orbit.user.model.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ContactService contactService;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, contactService);
    }

    @Test
    void getSelfProfileReturnsValidProfileWhenUserExists() {
        Instant now = Instant.now();
        User user = User.builder()
                .id("u123")
                .email("satyam@example.com")
                .displayName("Satyam")
                .bio("Software Engineer")
                .avatarUrl("https://example.com/avatar.jpg")
                .role(UserRole.USER)
                .createdAt(now)
                .build();

        when(userRepository.findById("u123")).thenReturn(Optional.of(user));

        SelfProfileResponse profile = userService.getSelfProfile("u123");

        assertThat(profile).isNotNull();
        assertThat(profile.id()).isEqualTo("u123");
        assertThat(profile.email()).isEqualTo("satyam@example.com");
        assertThat(profile.displayName()).isEqualTo("Satyam");
        assertThat(profile.bio()).isEqualTo("Software Engineer");
        assertThat(profile.avatarUrl()).isEqualTo("https://example.com/avatar.jpg");
        assertThat(profile.createdAt()).isEqualTo(now);
    }

    @Test
    void getSelfProfileThrowsResourceNotFoundWhenUserDoesNotExist() {
        when(userRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getSelfProfile("missing"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found: missing");
    }

    @Test
    void getSelfProfileThrowsResourceNotFoundWhenUserIdIsNull() {
        assertThatThrownBy(() -> userService.getSelfProfile(null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void getSelfProfileThrowsResourceNotFoundWhenUserIdIsBlank() {
        assertThatThrownBy(() -> userService.getSelfProfile("   "))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void getSelfProfileWithNullOptionalFieldsMapsProperly() {
        Instant now = Instant.now();
        User user = User.builder()
                .id("u456")
                .email("minimal@example.com")
                .displayName("Minimal")
                .bio(null)
                .avatarUrl(null)
                .role(UserRole.USER)
                .createdAt(now)
                .build();

        when(userRepository.findById("u456")).thenReturn(Optional.of(user));

        SelfProfileResponse profile = userService.getSelfProfile("u456");

        assertThat(profile).isNotNull();
        assertThat(profile.id()).isEqualTo("u456");
        assertThat(profile.email()).isEqualTo("minimal@example.com");
        assertThat(profile.displayName()).isEqualTo("Minimal");
        assertThat(profile.bio()).isNull();
        assertThat(profile.avatarUrl()).isNull();
        assertThat(profile.createdAt()).isEqualTo(now);
    }

    @Test
    void getUserProfileReturnsPublicProfileWhenNotBlocked() {
        User targetUser = User.builder()
                .id("target-1")
                .displayName("Target User")
                .bio("Target bio")
                .avatarUrl("https://example.com/target.jpg")
                .build();

        when(userRepository.findById("target-1")).thenReturn(Optional.of(targetUser));
        when(contactService.isBlockedBy("requester-1", "target-1")).thenReturn(false);
        when(contactService.getConnectionStatus("requester-1", "target-1")).thenReturn(ConnectionStatus.CONNECTED);

        UserProfileResponse response = userService.getUserProfile("target-1", "requester-1");

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo("target-1");
        assertThat(response.displayName()).isEqualTo("Target User");
        assertThat(response.bio()).isEqualTo("Target bio");
        assertThat(response.avatarUrl()).isEqualTo("https://example.com/target.jpg");
        assertThat(response.connectionStatus()).isEqualTo(ConnectionStatus.CONNECTED);
        assertThat(response.available()).isNull();
    }

    @Test
    void getUserProfileReturnsMaskedProfileWhenRequesterIsBlocked() {
        User targetUser = User.builder()
                .id("target-1")
                .displayName("Target User")
                .bio("Target bio")
                .avatarUrl("https://example.com/target.jpg")
                .build();

        when(userRepository.findById("target-1")).thenReturn(Optional.of(targetUser));
        when(contactService.isBlockedBy("requester-1", "target-1")).thenReturn(true);

        UserProfileResponse response = userService.getUserProfile("target-1", "requester-1");

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo("target-1");
        assertThat(response.available()).isFalse();
        assertThat(response.displayName()).isNull();
        assertThat(response.bio()).isNull();
        assertThat(response.avatarUrl()).isNull();
        assertThat(response.connectionStatus()).isNull();
    }

    @Test
    void getUserProfileReturnsFullProfileWhenRequesterIsTheBlocker() {
        User targetUser = User.builder()
                .id("target-1")
                .displayName("Target User")
                .bio("Target bio")
                .avatarUrl("https://example.com/target.jpg")
                .build();

        when(userRepository.findById("target-1")).thenReturn(Optional.of(targetUser));
        when(contactService.isBlockedBy("requester-1", "target-1")).thenReturn(false);
        when(contactService.getConnectionStatus("requester-1", "target-1")).thenReturn(ConnectionStatus.BLOCKED);

        UserProfileResponse response = userService.getUserProfile("target-1", "requester-1");

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo("target-1");
        assertThat(response.displayName()).isEqualTo("Target User");
        assertThat(response.connectionStatus()).isEqualTo(ConnectionStatus.BLOCKED);
        assertThat(response.available()).isNull();
    }

    @Test
    void getUserProfileThrowsNotFoundWhenTargetUserDoesNotExist() {
        when(userRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserProfile("missing", "requester-1"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found: missing");

        verifyNoInteractions(contactService);
    }

    @Test
    void getUserProfileThrowsNotFoundWhenTargetUserIdIsNull() {
        assertThatThrownBy(() -> userService.getUserProfile(null, "requester-1"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found");

        verifyNoInteractions(contactService);
    }

    @Test
    void getSuggestedUsersReturnsExcludingSelfAndContacts() {
        String currentUserId = "user-1";
        when(contactService.getExcludedUserIdsForSuggestions(currentUserId))
                .thenReturn(java.util.Set.of("user-2", "user-3"));

        User candidate = User.builder()
                .id("user-4")
                .displayName("Alex Rivera")
                .bio("Full stack dev")
                .avatarUrl("https://example.com/alex.jpg")
                .build();

        java.util.Set<String> expectedExcluded = java.util.Set.of("user-1", "user-2", "user-3");
        when(userRepository.findByIdNotIn(
                org.mockito.ArgumentMatchers.argThat(set -> set.containsAll(expectedExcluded) && set.size() == 3),
                org.mockito.ArgumentMatchers.any(org.springframework.data.domain.Pageable.class)
        )).thenReturn(java.util.List.of(candidate));

        java.util.List<com.orbit.user.dto.SuggestedUserResponse> result = userService.getSuggestedUsers(currentUserId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo("user-4");
        assertThat(result.get(0).displayName()).isEqualTo("Alex Rivera");
        assertThat(result.get(0).initials()).isEqualTo("AR");
        assertThat(result.get(0).bio()).isEqualTo("Full stack dev");
    }

    @Test
    void getSuggestedUsersReturnsEmptyWhenUserIdNullOrBlank() {
        assertThat(userService.getSuggestedUsers(null)).isEmpty();
        assertThat(userService.getSuggestedUsers("   ")).isEmpty();
        verifyNoInteractions(userRepository);
    }
}
