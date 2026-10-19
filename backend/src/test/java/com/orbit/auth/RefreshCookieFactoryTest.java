package com.orbit.auth;

import com.orbit.common.config.OrbitProperties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshCookieFactoryTest {

    private static RefreshCookieFactory factory(boolean secure, String sameSite) {
        return new RefreshCookieFactory(new OrbitProperties(
                new OrbitProperties.Jwt(
                        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", 900_000L, 604_800_000L),
                new OrbitProperties.Cors("http://localhost:4200"),
                new OrbitProperties.Cookie(secure, sameSite)));
    }

    @Test
    void cookieCarriesTheProductionSecurityAttributes() {
        String header = factory(true, "None").create("value").toString();

        assertThat(header)
                .startsWith("refreshToken=value;")
                .contains("HttpOnly")
                .contains("Secure")
                .contains("SameSite=None")
                .contains("Path=/api/v1/auth")
                .contains("Max-Age=604800");
    }

    @Test
    void secureAndSameSiteFollowConfiguration() {
        String header = factory(false, "Lax").create("value").toString();

        assertThat(header)
                .contains("HttpOnly")
                .contains("SameSite=Lax")
                .doesNotContain("Secure");
    }

    @Test
    void clearCookieHasMaxAgeZeroAndEmptyValue() {
        String header = factory(true, "None").clear().toString();

        assertThat(header)
                .startsWith("refreshToken=;")
                .contains("HttpOnly")
                .contains("Secure")
                .contains("SameSite=None")
                .contains("Path=/api/v1/auth")
                .contains("Max-Age=0");
    }
}