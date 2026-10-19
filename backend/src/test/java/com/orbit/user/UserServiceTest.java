package com.orbit.user;

import com.orbit.common.exception.ResourceNotFoundException;
import com.orbit.user.dto.SelfProfileResponse;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository);
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
}
