package com.orbit.common.storage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import static org.assertj.core.api.Assertions.assertThat;

class R2StorageConfigTest {

    private final R2StorageConfig config = new R2StorageConfig();

    @Test
    @DisplayName("s3Client returns null when storage properties are unconfigured")
    void s3Client_UnconfiguredReturnsNull() {
        R2StorageProperties properties = new R2StorageProperties();
        S3Client client = config.s3Client(properties);
        assertThat(client).isNull();
    }

    @Test
    @DisplayName("s3Presigner returns null when storage properties are unconfigured")
    void s3Presigner_UnconfiguredReturnsNull() {
        R2StorageProperties properties = new R2StorageProperties();
        S3Presigner presigner = config.s3Presigner(properties);
        assertThat(presigner).isNull();
    }

    @Test
    @DisplayName("s3Client and s3Presigner initialize with endpoint when configured")
    void s3ClientAndPresigner_ConfiguredCreatesClients() {
        R2StorageProperties properties = new R2StorageProperties();
        properties.setAccountId("test-account-id");
        properties.setAccessKeyId("test-access-key");
        properties.setSecretAccessKey("test-secret-key");
        properties.setBucketName("orbit-dev");

        S3Client client = config.s3Client(properties);
        S3Presigner presigner = config.s3Presigner(properties);

        assertThat(client).isNotNull();
        assertThat(presigner).isNotNull();

        client.close();
        presigner.close();
    }
}
