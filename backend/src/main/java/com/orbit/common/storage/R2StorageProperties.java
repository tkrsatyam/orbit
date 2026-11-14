package com.orbit.common.storage;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for Cloudflare R2 object storage.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "orbit.storage")
public class R2StorageProperties {

    /**
     * Cloudflare account identifier.
     */
    private String accountId = "";

    /**
     * S3-compatible R2 access key ID.
     */
    private String accessKeyId = "";

    /**
     * S3-compatible R2 secret access key.
     */
    private String secretAccessKey = "";

    /**
     * Target bucket name (defaults to 'orbit-dev').
     */
    private String bucketName = "orbit-dev";

    /**
     * Public distribution URL (e.g. 'https://pub-xxx.r2.dev').
     */
    private String publicUrl = "";

    /**
     * Returns true if required Cloudflare R2 credentials and account ID are provided.
     */
    public boolean isConfigured() {
        return accountId != null && !accountId.isBlank()
                && accessKeyId != null && !accessKeyId.isBlank()
                && secretAccessKey != null && !secretAccessKey.isBlank();
    }
}
