package com.orbit.auth;

import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.InvalidOriginException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OriginVerifierTest {

    private static final String FRONTEND = "http://localhost:5173";

    private static OriginVerifier verifierFor(String allowedOrigin) {
        return new OriginVerifier(new OrbitProperties(
                new OrbitProperties.Jwt(
                        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", 900_000L, 604_800_000L),
                new OrbitProperties.Cors(allowedOrigin),
                new OrbitProperties.Cookie(true, "None")));
    }

    private final OriginVerifier verifier = verifierFor(FRONTEND);

    @Test
    void requestWithoutAnOriginHeaderIsAllowed() {
        assertThatCode(() -> verifier.verify(null)).doesNotThrowAnyException();
    }

    @Test
    void configuredOriginIsAllowed() {
        assertThatCode(() -> verifier.verify(FRONTEND)).doesNotThrowAnyException();
    }

    @Test
    void otherOriginIsRejected() {
        assertThatThrownBy(() -> verifier.verify("https://evil.example"))
                .isInstanceOf(InvalidOriginException.class);
    }

    @Test
    void opaqueNullOriginIsRejected() {
        assertThatThrownBy(() -> verifier.verify("null"))
                .isInstanceOf(InvalidOriginException.class);
    }

    @Test
    void trailingSlashInTheConfiguredOriginIsIgnored() {
        assertThatCode(() -> verifierFor(FRONTEND + "/").verify(FRONTEND)).doesNotThrowAnyException();
    }
}