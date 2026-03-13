package com.talentflow.cvparser.shared.util;

import org.apache.tika.Tika;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * File validation utility.
 * Validates files by magic bytes (not extension) for security.
 *
 * <p><b>Important:</b> Callers are responsible for closing the InputStream.
 * This class does not take ownership of the stream.</p>
 */
@Component
@ConfigurationProperties(prefix = "file")
public class FileValidator {

    private final Tika tika = new Tika();

    // Pattern to detect path traversal attempts
    private static final Pattern PATH_TRAVERSAL_PATTERN = Pattern.compile(
            "(\\.\\./|\\.\\.\\\\|%2e%2e%2f|%2e%2e/|\\.\\.%2f|%2e%2e%5c)",
            Pattern.CASE_INSENSITIVE
    );

    // Pattern for valid S3 object keys (alphanumeric, hyphens, underscores, slashes, dots)
    private static final Pattern VALID_FILE_KEY_PATTERN = Pattern.compile(
            "^[a-zA-Z0-9/_.-]+$"
    );

    private int maxSizeMb = 10;
    private int maxPages = 20;
    private List<String> allowedTypes = List.of(
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    /**
     * Validate file by checking magic bytes.
     *
     * <p><b>Note:</b> Caller must close the InputStream after this method returns.</p>
     *
     * @param inputStream File input stream (caller must close)
     * @param fileName    Original filename (for logging only, not used for security decisions)
     * @param fileSize    File size in bytes
     * @return Detected MIME type
     * @throws IllegalArgumentException if validation fails
     */
    public String validate(InputStream inputStream, String fileName, long fileSize) {
        // Check file size
        long maxSizeBytes = (long) maxSizeMb * 1024 * 1024;
        if (fileSize > maxSizeBytes) {
            throw new IllegalArgumentException(
                    String.format("File size %d bytes exceeds maximum %d MB", fileSize, maxSizeMb)
            );
        }

        // Detect MIME type by magic bytes
        String detectedType;
        try {
            detectedType = tika.detect(inputStream);
        } catch (IOException e) {
            throw new IllegalArgumentException("Unable to detect file type", e);
        }

        // Check if type is allowed
        if (!allowedTypes.contains(detectedType)) {
            throw new IllegalArgumentException(
                    String.format("File type '%s' is not allowed. Allowed types: %s",
                            detectedType, allowedTypes)
            );
        }

        return detectedType;
    }

    /**
     * Validate S3 file key for path traversal and invalid characters.
     *
     * @param fileKey S3 object key to validate
     * @throws IllegalArgumentException if fileKey contains path traversal or invalid characters
     */
    public void validateFileKey(String fileKey) {
        if (fileKey == null || fileKey.isEmpty()) {
            throw new IllegalArgumentException("File key cannot be null or empty");
        }

        // Check for path traversal attempts
        if (PATH_TRAVERSAL_PATTERN.matcher(fileKey).find()) {
            throw new IllegalArgumentException("File key contains path traversal sequence");
        }

        // Check for valid characters only
        if (!VALID_FILE_KEY_PATTERN.matcher(fileKey).matches()) {
            throw new IllegalArgumentException("File key contains invalid characters");
        }

        // Check for double slashes (could indicate injection)
        if (fileKey.contains("//")) {
            throw new IllegalArgumentException("File key contains invalid double slash");
        }

        // Check key doesn't start with slash
        if (fileKey.startsWith("/")) {
            throw new IllegalArgumentException("File key cannot start with slash");
        }
    }

    /**
     * Validate bucket name format.
     *
     * @param bucket S3 bucket name
     * @throws IllegalArgumentException if bucket name is invalid
     */
    public void validateBucket(String bucket) {
        if (bucket == null || bucket.isEmpty()) {
            throw new IllegalArgumentException("Bucket name cannot be null or empty");
        }

        // S3 bucket naming rules: 3-63 chars, lowercase, numbers, hyphens
        if (bucket.length() < 3 || bucket.length() > 63) {
            throw new IllegalArgumentException("Bucket name must be 3-63 characters");
        }

        if (!bucket.matches("^[a-z0-9][a-z0-9.-]*[a-z0-9]$")) {
            throw new IllegalArgumentException("Bucket name contains invalid characters");
        }
    }

    /**
     * Check if MIME type is PDF.
     */
    public boolean isPdf(String mimeType) {
        return "application/pdf".equals(mimeType);
    }

    /**
     * Check if MIME type is DOCX.
     */
    public boolean isDocx(String mimeType) {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(mimeType);
    }

    /**
     * Get maximum allowed pages.
     */
    public int getMaxPages() {
        return maxPages;
    }

    /**
     * Get maximum file size in MB.
     */
    public int getMaxSizeMb() {
        return maxSizeMb;
    }

    // Setters for ConfigurationProperties binding
    public void setMaxSizeMb(int maxSizeMb) {
        this.maxSizeMb = maxSizeMb;
    }

    public void setMaxPages(int maxPages) {
        this.maxPages = maxPages;
    }

    public void setAllowedTypes(List<String> allowedTypes) {
        // Defensive copy to prevent external mutation
        this.allowedTypes = Collections.unmodifiableList(List.copyOf(allowedTypes));
    }

    /**
     * Get allowed MIME types (unmodifiable).
     */
    public List<String> getAllowedTypes() {
        return allowedTypes;
    }
}
