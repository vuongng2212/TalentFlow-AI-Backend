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
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Slf4j
@Service
public class S3StorageService implements StorageService {

    private final S3Client s3Client;
    private final FileValidator fileValidator;

    @Value("${storage.bucket}")
    private String bucket;

    @Value("${file.max-size-mb:10}")
    private int maxSizeMb;

    public S3StorageService(S3Client s3Client, FileValidator fileValidator) {
        this.s3Client = s3Client;
        this.fileValidator = fileValidator;
    }

    @Override
    public Path downloadSafely(String fileKey) throws IOException {
        // Validate key for path traversal and invalid characters
        fileValidator.validateFileKey(fileKey);

        HeadObjectResponse head;
        try {
            head = s3Client.headObject(
                    HeadObjectRequest.builder()
                            .bucket(bucket)
                            .key(fileKey)
                            .build()
            );
        } catch (NoSuchKeyException e) {
            throw new StorageObjectNotFoundException("File not found: " + fileKey);
        }

        long maxSizeBytes = (long) maxSizeMb * 1024 * 1024;
        if (head.contentLength() != null && head.contentLength() > maxSizeBytes) {
            log.warn("File too large. key={}, size={}, maxMb={}",
                    fileKey, head.contentLength(), maxSizeMb);
            throw new PayloadTooLargeException(
                    "File size " + head.contentLength() + " exceeds limit " + maxSizeBytes + " bytes");
        }

        Path tempFile = Files.createTempFile("cv-", ".tmp");
        try (ResponseInputStream<GetObjectResponse> s3Stream = s3Client.getObject(
                GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(fileKey)
                        .build())) {
            Files.copy(s3Stream, tempFile, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            Files.deleteIfExists(tempFile);
            throw new StorageReadException("Failed to read file: " + fileKey, e);
        }

        log.info("Downloaded s3://{}/{} → {}", bucket, fileKey, tempFile);
        return tempFile;
    }
}
