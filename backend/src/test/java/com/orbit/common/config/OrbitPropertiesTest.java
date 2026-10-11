package com.orbit.common.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OrbitPropertiesTest {

    @Test
    void sameSiteNoneWithoutSecureIsRejected() {
        assertThatThrownBy(() -> new OrbitProperties.Cookie(false, "None"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("secure");
    }

    @Test
    void laxWithoutSecureIsAllowed() {
        assertThatCode(() -> new OrbitProperties.Cookie(false, "Lax")).doesNotThrowAnyException();
    }
}