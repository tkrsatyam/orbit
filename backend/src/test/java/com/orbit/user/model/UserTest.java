package com.orbit.user.model;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class UserTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    private User createBaseUser() {
        return User.builder()
                .email("satyam@example.com")
                .passwordHash("hashed-password")
                .displayName("Satyam")
                .role(UserRole.USER)
                .online(false)
                .createdAt(Instant.now())
                .build();
    }

    @Test
    void validUserPassesValidation() {
        User user = createBaseUser();
        user.setBio("Valid bio under 500 characters");

        Set<ConstraintViolation<User>> violations = validator.validate(user);
        assertThat(violations).isEmpty();
    }

    @Test
    void validUserWithNullBioPassesValidation() {
        User user = createBaseUser();
        user.setBio(null);

        Set<ConstraintViolation<User>> violations = validator.validate(user);
        assertThat(violations).isEmpty();
    }

    @Test
    void displayNameWithTwoCharactersPassesValidation() {
        User user = createBaseUser();
        user.setDisplayName("SK");

        Set<ConstraintViolation<User>> violations = validator.validate(user);
        assertThat(violations).isEmpty();
    }

    @Test
    void displayNameWithFiftyCharactersPassesValidation() {
        User user = createBaseUser();
        user.setDisplayName("a".repeat(50));

        Set<ConstraintViolation<User>> violations = validator.validate(user);
        assertThat(violations).isEmpty();
    }

    @Test
    void displayNameTooShortFailsValidation() {
        User user = createBaseUser();
        user.setDisplayName("S");

        Set<ConstraintViolation<User>> violations = validator.validate(user);
        assertThat(violations).hasSize(1);
        assertThat(violations.iterator().next().getMessage())
                .isEqualTo("Display name must be between 2 and 50 characters");
    }

    @Test
    void displayNameTooLongFailsValidation() {
        User user = createBaseUser();
        user.setDisplayName("a".repeat(51));

        Set<ConstraintViolation<User>> violations = validator.validate(user);
        assertThat(violations).hasSize(1);
        assertThat(violations.iterator().next().getMessage())
                .isEqualTo("Display name must be between 2 and 50 characters");
    }

    @Test
    void bioWithFiveHundredCharactersPassesValidation() {
        User user = createBaseUser();
        user.setBio("a".repeat(500));

        Set<ConstraintViolation<User>> violations = validator.validate(user);
        assertThat(violations).isEmpty();
    }

    @Test
    void bioExceedingFiveHundredCharactersFailsValidation() {
        User user = createBaseUser();
        user.setBio("a".repeat(501));

        Set<ConstraintViolation<User>> violations = validator.validate(user);
        assertThat(violations).hasSize(1);
        assertThat(violations.iterator().next().getMessage())
                .isEqualTo("Bio must not exceed 500 characters");
    }
}
