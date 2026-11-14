package com.orbit.common.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

/**
 * Spring configuration providing S3Client and S3Presigner beans configured for Cloudflare R2.
 */
@Configuration
public class R2StorageConfig {

    private static final Logger log = LoggerFactory.getLogger(R2StorageConfig.class);

    @Bean
    @ConditionalOnMissingBean
    public S3Client s3Client(R2StorageProperties properties) {
        if (!properties.isConfigured()) {
            log.info("Cloudflare R2 storage credentials not fully specified. S3Client initialized in unconfigured mode.");
            return null;
        }

        URI endpoint = URI.create("https://" + properties.getAccountId().trim() + ".r2.cloudflarestorage.com");
        AwsBasicCredentials credentials = AwsBasicCredentials.create(
                properties.getAccessKeyId().trim(),
                properties.getSecretAccessKey().trim()
        );

        log.info("Configuring S3Client for Cloudflare R2: endpoint={}, bucket={}", endpoint, properties.getBucketName());

        return S3Client.builder()
                .endpointOverride(endpoint)
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .region(Region.of("auto"))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();
    }

    @Bean
    @ConditionalOnMissingBean
    public S3Presigner s3Presigner(R2StorageProperties properties) {
        if (!properties.isConfigured()) {
            log.info("Cloudflare R2 storage credentials not fully specified. S3Presigner initialized in unconfigured mode.");
            return null;
        }

        URI endpoint = URI.create("https://" + properties.getAccountId().trim() + ".r2.cloudflarestorage.com");
        AwsBasicCredentials credentials = AwsBasicCredentials.create(
                properties.getAccessKeyId().trim(),
                properties.getSecretAccessKey().trim()
        );

        return S3Presigner.builder()
                .endpointOverride(endpoint)
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .region(Region.of("auto"))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();
    }
}
