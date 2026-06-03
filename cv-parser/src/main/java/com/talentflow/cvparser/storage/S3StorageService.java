package com.talentflow.cvparser.storage;

import com.talentflow.cvparser.shared.exception.PayloadTooLargeException;
import com.talentflow.cvparser.shared.exception.StorageObjectNotFoundException;
import com.talentflow.cvparser.shared.exception.StorageReadException;
import com.talentflow.cvparser.shared.util.FileValidator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

@Slf4j
@Service
public class S3StorageService implements StorageService {

    private final S3Client s3Client;
    private final FileValidator fileValidator;

    @Value("${storage.bucket}")
    private String bucket;

    @Value("${file.max-size-mb:10}")
    private int maxSizeMb;

    @Value("${app.storage.temp-dir:}")
    private String tempDir;

    public S3StorageService(S3Client s3Client, FileValidator fileValidator) {
        this.s3Client = s3Client;
        this.fileValidator = fileValidator;
    }

    @Override
    public Path downloadSafely(String fileKey) throws IOException {
        fileValidator.validateFileKey(fileKey);

        long maxSizeBytes = (long) maxSizeMb * 1024 * 1024;
        Path tempFile = createTempFile();

        try (ResponseInputStream<GetObjectResponse> s3Stream = s3Client.getObject(
                GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(fileKey)
                        .build())) {

            Long contentLength = s3Stream.response().contentLength();
            if (contentLength != null && contentLength > maxSizeBytes) {
                log.warn("File too large (pre-stream check). key={}, size={}, maxMb={}",
                        fileKey, contentLength, maxSizeMb);
                throw new PayloadTooLargeException(
                        "File size " + contentLength + " exceeds limit " + maxSizeBytes + " bytes");
            }

            copyWithLimit(s3Stream, tempFile, maxSizeBytes, fileKey);

        } catch (NoSuchKeyException e) {
            Files.deleteIfExists(tempFile);
            throw new StorageObjectNotFoundException("File not found: " + fileKey);
        } catch (PayloadTooLargeException e) {
            Files.deleteIfExists(tempFile);
            throw e;
        } catch (IOException e) {
            Files.deleteIfExists(tempFile);
            throw new StorageReadException("Failed to read file: " + fileKey, e);
        }

        log.info("Downloaded s3://{}/{} → {}", bucket, fileKey, tempFile);
        return tempFile;
    }

    private Path createTempFile() throws IOException {
        Path createdTempFile;
        if (tempDir != null && !tempDir.isBlank()) {
            Path secureTempDir = Path.of(tempDir).toAbsolutePath().normalize();
            Files.createDirectories(secureTempDir);
            createdTempFile = Files.createTempFile(secureTempDir, "cv-", ".tmp");
        } else {
            createdTempFile = Files.createTempFile("cv-", ".tmp");
        }
        return createdTempFile;
    }

    private void copyWithLimit(ResponseInputStream<GetObjectResponse> s3Stream,
                               Path destination,
                               long maxSizeBytes,
                               String fileKey) throws IOException {
        long totalBytes = 0;
        byte[] buffer = new byte[65536];

        try (OutputStream outputStream = Files.newOutputStream(destination)) {
            int bytesRead;
            while ((bytesRead = s3Stream.read(buffer)) != -1) {
                totalBytes += bytesRead;
                if (totalBytes > maxSizeBytes) {
                    log.warn("Stream exceeded size limit while downloading. key={}, streamedBytes={}, maxBytes={}",
                            fileKey, totalBytes, maxSizeBytes);
                    throw new PayloadTooLargeException(
                            "File size exceeds limit " + maxSizeBytes + " bytes during download");
                }
                outputStream.write(buffer, 0, bytesRead);
            }
        }
    }
}
