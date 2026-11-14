package com.orbit.common.storage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.io.File;
import java.io.FileInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class R2LiveIntegrationTest {

    private static final Logger log = LoggerFactory.getLogger(R2LiveIntegrationTest.class);

    @Test
    @DisplayName("Verify live Cloudflare R2 roundtrip: upload, presign, download, and delete")
    void testLiveR2RoundTrip() throws Exception {
        // Load properties from .env if present, otherwise system env
        Properties envProps = new Properties();
        File envFile = new File(".env");
        if (envFile.exists()) {
            try (FileInputStream fis = new FileInputStream(envFile)) {
                envProps.load(fis);
            }
        }

        R2StorageProperties properties = new R2StorageProperties();
        properties.setAccountId(getProp(envProps, "R2_ACCOUNT_ID"));
        properties.setAccessKeyId(getProp(envProps, "R2_ACCESS_KEY_ID"));
        properties.setSecretAccessKey(getProp(envProps, "R2_SECRET_ACCESS_KEY"));
        properties.setBucketName(getPropOrDefault(envProps, "R2_BUCKET_NAME", "orbit-dev"));
        properties.setPublicUrl(getPropOrDefault(envProps, "R2_PUBLIC_URL", ""));

        assumeTrue(properties.isConfigured(), "Cloudflare R2 is not configured in .env; skipping live test");

        R2StorageConfig config = new R2StorageConfig();
        S3Client s3Client = config.s3Client(properties);
        S3Presigner s3Presigner = config.s3Presigner(properties);
        R2StorageClient storageClient = new R2StorageClient(properties, s3Client, s3Presigner);

        assertThat(storageClient.isConfigured()).isTrue();
        log.info("Live R2 test connected successfully to bucket: {}", properties.getBucketName());

        String testKey = "test/verification-" + System.currentTimeMillis() + ".txt";
        byte[] testPayload = "Orbit Cloudflare R2 live verification check.".getBytes(StandardCharsets.UTF_8);

        // 1. Upload to Cloudflare R2
        String publicUrl = storageClient.upload(testKey, testPayload, "text/plain");
        assertThat(publicUrl).isNotBlank();
        log.info("Object uploaded to R2 successfully");

        // 2. Generate Presigned GET URL (10 min expiry)
        String presignedUrl = storageClient.generatePresignedUrl(testKey, Duration.ofMinutes(10));
        assertThat(presignedUrl).isNotBlank();
        log.info("Presigned GET URL generated successfully");

        // 3. Fetch object from Cloudflare R2 using the Presigned URL
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        HttpRequest getRequest = HttpRequest.newBuilder()
                .uri(URI.create(presignedUrl))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(getRequest, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo("Orbit Cloudflare R2 live verification check.");
        log.info("Verified object download via Presigned URL: HTTP 200 OK, payload matched");

        // 4. Verify Public URL accessibility if public URL domain is configured
        if (properties.getPublicUrl() != null && !properties.getPublicUrl().isBlank()) {
            try {
                HttpRequest pubRequest = HttpRequest.newBuilder()
                        .uri(URI.create(publicUrl))
                        .timeout(Duration.ofSeconds(10))
                        .GET()
                        .build();

                HttpResponse<String> pubResponse = httpClient.send(pubRequest, HttpResponse.BodyHandlers.ofString());
                log.info("Public URL check status: {}", pubResponse.statusCode());
            } catch (Exception e) {
                log.warn("Public URL check exception: {}", e.getMessage());
            }
        }

        // 5. Cleanup: Delete object from Cloudflare R2
        storageClient.delete(testKey);
        log.info("Object deleted from bucket: {}", testKey);

        // 6. Verify Deleted: Presigned GET should no longer return 200 OK
        HttpResponse<String> verifyDeletedResponse = httpClient.send(getRequest, HttpResponse.BodyHandlers.ofString());
        assertThat(verifyDeletedResponse.statusCode()).isNotEqualTo(200);
        log.info("Verified object is deleted: HTTP status {}", verifyDeletedResponse.statusCode());

        // Close S3 clients
        if (s3Client != null) s3Client.close();
        if (s3Presigner != null) s3Presigner.close();
    }

    private String getProp(Properties props, String key) {
        String val = props.getProperty(key);
        if (val == null || val.isBlank()) {
            val = System.getenv(key);
        }
        return val != null ? val.trim() : "";
    }

    private String getPropOrDefault(Properties props, String key, String defaultValue) {
        String val = getProp(props, key);
        return val.isBlank() ? defaultValue : val;
    }
}
