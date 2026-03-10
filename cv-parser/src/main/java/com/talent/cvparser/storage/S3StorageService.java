package com.talent.cvparser.storage;

import com.talent.cvparser.shared.config.S3Properties;
import com.talent.cvparser.shared.exception.InvalidStorageKeyException;
import com.talent.cvparser.shared.exception.PayloadTooLargeException;
import com.talent.cvparser.shared.exception.StorageObjectNotFoundException;
import com.talent.cvparser.shared.exception.StorageReadException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3StorageService implements StorageService {

    private static final Pattern SAFE_KEY_PATTERN =
        Pattern.compile("^[a-zA-Z0-9/_\\-\\.]{1,512}$");

    private final S3Client s3Client;
    private final S3Properties properties;

    @Override
    public Path downloadSafely(String objectKey) throws IOException {
        if (objectKey == null || !SAFE_KEY_PATTERN.matcher(objectKey).matches()) {
            log.error("Security alert: Invalid objectKey rejected: {}", objectKey);
            throw new InvalidStorageKeyException("Invalid object key: " + objectKey);
        }

        HeadObjectResponse head = s3Client.headObject(
            HeadObjectRequest.builder()
                .bucket(properties.getBucket())
                .key(objectKey) 
                .build()
        );
        if (head.contentLength() != null
                && head.contentLength() > properties.getMaxFileSizeBytes()) {
            log.warn("File too large. key={}, size={}, max={}",
                objectKey, head.contentLength(), properties.getMaxFileSizeBytes());
            throw new PayloadTooLargeException(
                "File size " + head.contentLength() + " exceeds limit "
                + properties.getMaxFileSizeBytes());
        }

        Path tempFile = Files.createTempFile("cv-", ".tmp");
        try (ResponseInputStream<GetObjectResponse> s3Stream = s3Client.getObject(
                GetObjectRequest.builder()
                    .bucket(properties.getBucket())
                    .key(objectKey)
                    .build())) {
            Files.copy(s3Stream, tempFile, StandardCopyOption.REPLACE_EXISTING);
        } catch (NoSuchKeyException e) {
            Files.deleteIfExists(tempFile);
            throw new StorageObjectNotFoundException("File not found: " + objectKey);
        } catch (IOException e) {
            Files.deleteIfExists(tempFile);
            throw new StorageReadException("Failed to read file: " + objectKey + "  " + e.getMessage(), e);
        }
        log.info("Downloaded {} → {}", objectKey, tempFile);
        return tempFile;
    }
}   
