package com.orbit.common.storage;

import com.orbit.common.exception.StorageException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.InputStream;
import java.net.URI;
import java.time.Duration;

/**
 * Shared storage client wrapping Cloudflare R2 via AWS S3 SDK v2.
 *
 * <p>Used across user profile avatars (UserService), group community assets (GroupService),
 * and message media attachments (MessageService). Provides methods for direct object
 * uploads, deletions, and 1-hour presigned URL generation.
 */
@Component
public class R2StorageClient {

    private static final Logger log = LoggerFactory.getLogger(R2StorageClient.class);
    private static final Duration DEFAULT_PRESIGNED_EXPIRY = Duration.ofHours(1);

    private final R2StorageProperties properties;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    public R2StorageClient(
            R2StorageProperties properties,
            @Autowired(required = false) S3Client s3Client,
            @Autowired(required = false) S3Presigner s3Presigner) {
        this.properties = properties;
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
    }

    /**
     * Checks if the storage client has live S3 client and configuration.
     */
    public boolean isConfigured() {
        return properties.isConfigured() && s3Client != null;
    }

    /**
     * Uploads in-memory byte content to storage.
     *
     * @param key         target object key (e.g. "avatars/64f1a2b3c4d5e6f7a8b9c0d1.jpg")
     * @param bytes       file content bytes
     * @param contentType MIME type (e.g. "image/jpeg", "image/png", "image/webp")
     * @return the public URL pointing to the uploaded object
     */
    public String upload(String key, byte[] bytes, String contentType) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Storage object key must not be null or blank");
        }
        if (bytes == null) {
            throw new IllegalArgumentException("Upload bytes must not be null");
        }

        String normalizedKey = extractKey(key);
        String effectiveContentType = (contentType == null || contentType.isBlank())
                ? "application/octet-stream"
                : contentType;

        if (!isConfigured()) {
            log.warn("Cloudflare R2 is unconfigured. Simulating byte upload for key: {}", normalizedKey);
            return getPublicUrl(normalizedKey);
        }

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(properties.getBucketName())
                    .key(normalizedKey)
                    .contentType(effectiveContentType)
                    .contentLength((long) bytes.length)
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromBytes(bytes));
            log.info("Successfully uploaded object to Cloudflare R2: bucket={}, key={}, size={} bytes",
                    properties.getBucketName(), normalizedKey, bytes.length);

            return getPublicUrl(normalizedKey);
        } catch (Exception e) {
            log.error("Failed to upload object to Cloudflare R2: bucket={}, key={}", properties.getBucketName(), normalizedKey, e);
            throw new StorageException("Failed to upload object to storage: " + e.getMessage(), e);
        }
    }

    /**
     * Uploads input stream content to storage.
     *
     * @param key           target object key
     * @param inputStream   stream of content
     * @param contentLength total length of stream in bytes
     * @param contentType   MIME type
     * @return the public URL pointing to the uploaded object
     */
    public String upload(String key, InputStream inputStream, long contentLength, String contentType) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Storage object key must not be null or blank");
        }
        if (inputStream == null) {
            throw new IllegalArgumentException("Upload inputStream must not be null");
        }

        String normalizedKey = extractKey(key);
        String effectiveContentType = (contentType == null || contentType.isBlank())
                ? "application/octet-stream"
                : contentType;

        if (!isConfigured()) {
            log.warn("Cloudflare R2 is unconfigured. Simulating stream upload for key: {}", normalizedKey);
            return getPublicUrl(normalizedKey);
        }

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(properties.getBucketName())
                    .key(normalizedKey)
                    .contentType(effectiveContentType)
                    .contentLength(contentLength)
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromInputStream(inputStream, contentLength));
            log.info("Successfully uploaded stream to Cloudflare R2: bucket={}, key={}, size={} bytes",
                    properties.getBucketName(), normalizedKey, contentLength);

            return getPublicUrl(normalizedKey);
        } catch (Exception e) {
            log.error("Failed to upload stream to Cloudflare R2: bucket={}, key={}", properties.getBucketName(), normalizedKey, e);
            throw new StorageException("Failed to upload stream to storage: " + e.getMessage(), e);
        }
    }

    /**
     * Deletes an object from the bucket.
     *
     * @param urlOrKey either full URL or relative object key
     */
    public void delete(String urlOrKey) {
        if (urlOrKey == null || urlOrKey.isBlank()) {
            return;
        }

        String normalizedKey = extractKey(urlOrKey);
        if (normalizedKey.isBlank()) {
            return;
        }

        if (!isConfigured()) {
            log.warn("Cloudflare R2 is unconfigured. Simulating delete for key: {}", normalizedKey);
            return;
        }

        try {
            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(properties.getBucketName())
                    .key(normalizedKey)
                    .build();

            s3Client.deleteObject(deleteRequest);
            log.info("Successfully deleted object from Cloudflare R2: bucket={}, key={}", properties.getBucketName(), normalizedKey);
        } catch (Exception e) {
            log.error("Failed to delete object from Cloudflare R2: bucket={}, key={}", properties.getBucketName(), normalizedKey, e);
            throw new StorageException("Failed to delete object from storage: " + e.getMessage(), e);
        }
    }

    /**
     * Generates a temporary presigned GET URL for controlled-access media/attachments.
     *
     * @param urlOrKey either full URL or relative object key
     * @param duration time to live before URL expiry (defaults to 1 hour if null)
     * @return signed URL string
     */
    public String generatePresignedUrl(String urlOrKey, Duration duration) {
        if (urlOrKey == null || urlOrKey.isBlank()) {
            throw new IllegalArgumentException("Object URL or key must not be null or blank");
        }

        String normalizedKey = extractKey(urlOrKey);
        Duration effectiveDuration = (duration != null && !duration.isNegative() && !duration.isZero())
                ? duration
                : DEFAULT_PRESIGNED_EXPIRY;

        if (!properties.isConfigured() || s3Presigner == null) {
            log.warn("Cloudflare R2 is unconfigured. Simulating presigned URL for key: {}", normalizedKey);
            return getPublicUrl(normalizedKey) + "?presigned=mock&expiresIn=" + effectiveDuration.getSeconds();
        }

        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(properties.getBucketName())
                    .key(normalizedKey)
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(effectiveDuration)
                    .getObjectRequest(getObjectRequest)
                    .build();

            PresignedGetObjectRequest presignedRequest = s3Presigner.presignGetObject(presignRequest);
            String presignedUrl = presignedRequest.url().toString();
            log.debug("Generated presigned URL for key={}, expiry={}", normalizedKey, effectiveDuration);
            return presignedUrl;
        } catch (Exception e) {
            log.error("Failed to generate presigned URL from Cloudflare R2: bucket={}, key={}", properties.getBucketName(), normalizedKey, e);
            throw new StorageException("Failed to generate presigned URL: " + e.getMessage(), e);
        }
    }

    /**
     * Computes the public URL for a given object key.
     *
     * @param key object key
     * @return full public URL
     */
    public String getPublicUrl(String key) {
        String normalizedKey = extractKey(key);
        String publicUrl = properties.getPublicUrl();

        if (publicUrl != null && !publicUrl.isBlank()) {
            String baseUrl = publicUrl.trim().replaceAll("/+$", "");
            return baseUrl + "/" + normalizedKey;
        }

        if (properties.isConfigured()) {
            return "https://" + properties.getBucketName() + "." + properties.getAccountId().trim() + ".r2.cloudflarestorage.com/" + normalizedKey;
        }

        return "https://mock-r2.orbit.dev/" + properties.getBucketName() + "/" + normalizedKey;
    }

    /**
     * Extracts the storage key from a full URL or relative path.
     *
     * @param urlOrKey full URL or relative key
     * @return clean object key
     */
    public String extractKey(String urlOrKey) {
        if (urlOrKey == null || urlOrKey.isBlank()) {
            return "";
        }

        String trimmed = urlOrKey.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            try {
                URI uri = URI.create(trimmed);
                String path = uri.getPath();
                if (path != null && path.startsWith("/")) {
                    path = path.substring(1);
                }
                return path != null ? path : trimmed;
            } catch (Exception e) {
                return trimmed;
            }
        }

        return trimmed.startsWith("/") ? trimmed.substring(1) : trimmed;
    }
}
