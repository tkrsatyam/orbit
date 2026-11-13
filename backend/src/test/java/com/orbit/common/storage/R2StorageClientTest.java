package com.orbit.common.storage;

import com.orbit.common.exception.StorageException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.ByteArrayInputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class R2StorageClientTest {

    @Mock
    private S3Client s3Client;

    @Mock
    private S3Presigner s3Presigner;

    private R2StorageProperties configuredProperties;
    private R2StorageProperties unconfiguredProperties;
    private R2StorageClient client;
    private R2StorageClient unconfiguredClient;

    @BeforeEach
    void setUp() {
        configuredProperties = new R2StorageProperties();
        configuredProperties.setAccountId("cf-account-123");
        configuredProperties.setAccessKeyId("access-key-xyz");
        configuredProperties.setSecretAccessKey("secret-key-xyz");
        configuredProperties.setBucketName("orbit-dev");
        configuredProperties.setPublicUrl("https://pub-abc123xyz.r2.dev");

        unconfiguredProperties = new R2StorageProperties();

        client = new R2StorageClient(configuredProperties, s3Client, s3Presigner);
        unconfiguredClient = new R2StorageClient(unconfiguredProperties, null, null);
    }

    @Test
    @DisplayName("isConfigured returns true only when credentials and client exist")
    void isConfigured_Verification() {
        assertThat(client.isConfigured()).isTrue();
        assertThat(unconfiguredClient.isConfigured()).isFalse();

        R2StorageClient clientWithoutS3 = new R2StorageClient(configuredProperties, null, null);
        assertThat(clientWithoutS3.isConfigured()).isFalse();
    }

    @Test
    @DisplayName("extractKey correctly parses URLs and relative paths")
    void extractKey_Variations() {
        assertThat(client.extractKey("avatars/user1.jpg")).isEqualTo("avatars/user1.jpg");
        assertThat(client.extractKey("/avatars/user1.jpg")).isEqualTo("avatars/user1.jpg");
        assertThat(client.extractKey("https://pub-abc123xyz.r2.dev/avatars/user1.jpg")).isEqualTo("avatars/user1.jpg");
        assertThat(client.extractKey("http://localhost:8080/attachments/file.pdf")).isEqualTo("attachments/file.pdf");
        assertThat(client.extractKey("")).isEmpty();
        assertThat(client.extractKey(null)).isEmpty();
    }

    @Test
    @DisplayName("getPublicUrl trims trailing slashes and formats clean URL")
    void getPublicUrl_Formatting() {
        configuredProperties.setPublicUrl("https://pub-abc123xyz.r2.dev///");
        String url = client.getPublicUrl("avatars/user-99.png");
        assertThat(url).isEqualTo("https://pub-abc123xyz.r2.dev/avatars/user-99.png");

        configuredProperties.setPublicUrl("");
        String fallbackUrl = client.getPublicUrl("avatars/user-99.png");
        assertThat(fallbackUrl).isEqualTo("https://orbit-dev.cf-account-123.r2.cloudflarestorage.com/avatars/user-99.png");
    }

    @Test
    @DisplayName("upload bytes successfully puts object and returns public URL")
    void uploadBytes_Success() {
        byte[] data = "avatar-data".getBytes(StandardCharsets.UTF_8);

        String resultUrl = client.upload("avatars/user1.jpg", data, "image/jpeg");

        assertThat(resultUrl).isEqualTo("https://pub-abc123xyz.r2.dev/avatars/user1.jpg");

        ArgumentCaptor<PutObjectRequest> putCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(putCaptor.capture(), any(RequestBody.class));

        PutObjectRequest request = putCaptor.getValue();
        assertThat(request.bucket()).isEqualTo("orbit-dev");
        assertThat(request.key()).isEqualTo("avatars/user1.jpg");
        assertThat(request.contentType()).isEqualTo("image/jpeg");
        assertThat(request.contentLength()).isEqualTo((long) data.length);
    }

    @Test
    @DisplayName("upload input stream successfully puts object")
    void uploadInputStream_Success() {
        byte[] data = "stream-content".getBytes(StandardCharsets.UTF_8);
        ByteArrayInputStream stream = new ByteArrayInputStream(data);

        String resultUrl = client.upload("files/doc.pdf", stream, data.length, "application/pdf");

        assertThat(resultUrl).isEqualTo("https://pub-abc123xyz.r2.dev/files/doc.pdf");

        ArgumentCaptor<PutObjectRequest> putCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(putCaptor.capture(), any(RequestBody.class));

        PutObjectRequest request = putCaptor.getValue();
        assertThat(request.bucket()).isEqualTo("orbit-dev");
        assertThat(request.key()).isEqualTo("files/doc.pdf");
        assertThat(request.contentType()).isEqualTo("application/pdf");
        assertThat(request.contentLength()).isEqualTo((long) data.length);
    }

    @Test
    @DisplayName("upload rejects null or blank key")
    void upload_RejectsInvalidKey() {
        byte[] data = "abc".getBytes();
        assertThatThrownBy(() -> client.upload("", data, "image/png"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> client.upload(null, data, "image/png"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("upload throws StorageException when S3 client fails")
    void upload_FailureThrowsStorageException() {
        byte[] data = "abc".getBytes();
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(S3Exception.builder().message("Access Denied").build());

        assertThatThrownBy(() -> client.upload("avatars/fail.jpg", data, "image/jpeg"))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("Failed to upload object to storage");
    }

    @Test
    @DisplayName("unconfigured upload simulates upload gracefully without error")
    void upload_UnconfiguredFallback() {
        byte[] data = "abc".getBytes();
        String result = unconfiguredClient.upload("avatars/simulated.jpg", data, "image/jpeg");
        assertThat(result).contains("avatars/simulated.jpg");
    }

    @Test
    @DisplayName("delete invokes deleteObject with extracted key")
    void delete_Success() {
        client.delete("https://pub-abc123xyz.r2.dev/avatars/old-avatar.jpg");

        ArgumentCaptor<DeleteObjectRequest> delCaptor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(delCaptor.capture());

        DeleteObjectRequest req = delCaptor.getValue();
        assertThat(req.bucket()).isEqualTo("orbit-dev");
        assertThat(req.key()).isEqualTo("avatars/old-avatar.jpg");
    }

    @Test
    @DisplayName("delete ignores null or empty key")
    void delete_NullOrEmptyIgnored() {
        client.delete(null);
        client.delete("   ");
        verifyNoInteractions(s3Client);
    }

    @Test
    @DisplayName("delete throws StorageException when S3 client fails")
    void delete_ThrowsStorageException() {
        doThrow(S3Exception.builder().message("Bucket not found").build())
                .when(s3Client).deleteObject(any(DeleteObjectRequest.class));

        assertThatThrownBy(() -> client.delete("avatars/file.png"))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("Failed to delete object from storage");
    }

    @Test
    @DisplayName("generatePresignedUrl invokes s3Presigner and returns presigned URL")
    void generatePresignedUrl_Success() throws Exception {
        PresignedGetObjectRequest presignedResponse = mock(PresignedGetObjectRequest.class);
        when(presignedResponse.url()).thenReturn(new URL("https://pub-abc123xyz.r2.dev/files/sample.pdf?X-Amz-Signature=xyz"));
        when(s3Presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presignedResponse);

        String signedUrl = client.generatePresignedUrl("files/sample.pdf", Duration.ofMinutes(30));

        assertThat(signedUrl).contains("X-Amz-Signature=xyz");

        ArgumentCaptor<GetObjectPresignRequest> presignCaptor = ArgumentCaptor.forClass(GetObjectPresignRequest.class);
        verify(s3Presigner).presignGetObject(presignCaptor.capture());

        GetObjectPresignRequest req = presignCaptor.getValue();
        assertThat(req.signatureDuration()).isEqualTo(Duration.ofMinutes(30));
        assertThat(req.getObjectRequest().bucket()).isEqualTo("orbit-dev");
        assertThat(req.getObjectRequest().key()).isEqualTo("files/sample.pdf");
    }

    @Test
    @DisplayName("generatePresignedUrl defaults to 1 hour expiry when null or zero duration passed")
    void generatePresignedUrl_DefaultsToOneHour() throws Exception {
        PresignedGetObjectRequest presignedResponse = mock(PresignedGetObjectRequest.class);
        when(presignedResponse.url()).thenReturn(new URL("https://pub-abc123xyz.r2.dev/files/sample.pdf?signed=true"));
        when(s3Presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presignedResponse);

        client.generatePresignedUrl("files/sample.pdf", null);

        ArgumentCaptor<GetObjectPresignRequest> presignCaptor = ArgumentCaptor.forClass(GetObjectPresignRequest.class);
        verify(s3Presigner).presignGetObject(presignCaptor.capture());

        assertThat(presignCaptor.getValue().signatureDuration()).isEqualTo(Duration.ofHours(1));
    }

    @Test
    @DisplayName("generatePresignedUrl simulates URL when unconfigured")
    void generatePresignedUrl_UnconfiguredFallback() {
        String result = unconfiguredClient.generatePresignedUrl("files/sample.pdf", Duration.ofHours(1));
        assertThat(result).contains("files/sample.pdf").contains("expiresIn=3600");
    }
}
