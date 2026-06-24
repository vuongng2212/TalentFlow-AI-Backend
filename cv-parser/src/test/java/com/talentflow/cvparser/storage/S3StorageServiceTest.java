package com.talentflow.cvparser.storage;

import com.talentflow.cvparser.shared.exception.PayloadTooLargeException;
import com.talentflow.cvparser.shared.exception.StorageObjectNotFoundException;
import com.talentflow.cvparser.shared.exception.StorageReadException;
import com.talentflow.cvparser.shared.util.FileValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class S3StorageServiceTest {

    @TempDir
    Path tempDir;

    private S3Client s3Client;
    private FileValidator fileValidator;
    private S3StorageService service;

    @BeforeEach
    void setUp() {
        s3Client = mock(S3Client.class);
        fileValidator = mock(FileValidator.class);
        service = new S3StorageService(s3Client, fileValidator);
        ReflectionTestUtils.setField(service, "bucket", "talentflow-cvs");
        ReflectionTestUtils.setField(service, "maxSizeMb", 10);
        ReflectionTestUtils.setField(service, "tempDir", tempDir.toString());
    }

    @Test
    void downloadSafelyCreatesTempFileInConfiguredDirectory() throws IOException {
        when(s3Client.getObject(any(GetObjectRequest.class)))
                .thenReturn(responseStream(
                        new ByteArrayInputStream("abc".getBytes(StandardCharsets.UTF_8)),
                        3L));

        Path downloaded = service.downloadSafely("cvs/test.pdf");

        assertThat(downloaded).startsWith(tempDir);
        assertThat(Files.readString(downloaded)).isEqualTo("abc");
        verify(fileValidator).validateFileKey("cvs/test.pdf");

        Files.deleteIfExists(downloaded);
    }

    @Test
    void downloadSafelyRejectsOversizeBeforeDownloading() throws IOException {
        ReflectionTestUtils.setField(service, "maxSizeMb", 1);
        long oversizeBytes = 2L * 1024 * 1024;
        when(s3Client.getObject(any(GetObjectRequest.class)))
                .thenReturn(responseStream(InputStream.nullInputStream(), oversizeBytes));

        assertThatThrownBy(() -> service.downloadSafely("cvs/big.pdf"))
                .isInstanceOf(PayloadTooLargeException.class);

        try (Stream<Path> files = Files.list(tempDir)) {
            assertThat(files.toList()).isEmpty();
        }
    }

    @Test
    void downloadSafelyThrowsNotFoundWhenObjectMissing() {
        when(s3Client.getObject(any(GetObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().message("missing").build());

        assertThatThrownBy(() -> service.downloadSafely("cvs/missing.pdf"))
                .isInstanceOf(StorageObjectNotFoundException.class);
    }

    @Test
    void downloadSafelyRejectsOversizeDuringStreamCopy() {
        ReflectionTestUtils.setField(service, "maxSizeMb", 1);
        when(s3Client.getObject(any(GetObjectRequest.class)))
                .thenReturn(responseStream(new ByteArrayInputStream(new byte[1024 * 1024 + 1])));

        assertThatThrownBy(() -> service.downloadSafely("cvs/metadata-lie.pdf"))
                .isInstanceOf(PayloadTooLargeException.class);

        try (Stream<Path> files = Files.list(tempDir)) {
            assertThat(files.toList()).isEmpty();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void downloadSafelyDeletesPartialFileWhenCopyFails() {
        InputStream brokenStream = new InputStream() {
            @Override
            public int read() throws IOException {
                throw new IOException("boom");
            }
        };
        when(s3Client.getObject(any(GetObjectRequest.class)))
                .thenReturn(responseStream(brokenStream));

        assertThatThrownBy(() -> service.downloadSafely("cvs/broken.pdf"))
                .isInstanceOf(StorageReadException.class);

        try (Stream<Path> files = Files.list(tempDir)) {
            assertThat(files.toList()).isEmpty();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private ResponseInputStream<GetObjectResponse> responseStream(InputStream inputStream) {
        return new ResponseInputStream<>(
                GetObjectResponse.builder().build(),
                AbortableInputStream.create(inputStream)
        );
    }

    private ResponseInputStream<GetObjectResponse> responseStream(InputStream inputStream, long contentLength) {
        return new ResponseInputStream<>(
                GetObjectResponse.builder().contentLength(contentLength).build(),
                AbortableInputStream.create(inputStream)
        );
    }
}
