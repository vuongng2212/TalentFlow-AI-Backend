package com.talentflow.cvparser.shared.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Event received when a CV is uploaded.
 *
 * SECURITY NOTE: Do NOT include fileUrl in this event.
 * Consumers MUST use bucket + fileKey with S3 credentials to download files.
 * This prevents SSRF attacks from arbitrary URLs.
 *
 * @see docs/adr/ADR-009-rabbitmq-polyglot.md for message payload specification
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CvUploadedEvent {

    private static final String UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    /**
     * UUID of the candidate who uploaded the CV.
     */
    @NotBlank(message = "candidateId is required")
    @Pattern(regexp = UUID_PATTERN, message = "candidateId must be a valid UUID")
    private String candidateId;

    /**
     * UUID of the job application.
     */
    @NotBlank(message = "applicationId is required")
    @Pattern(regexp = UUID_PATTERN, message = "applicationId must be a valid UUID")
    private String applicationId;

    /**
     * UUID of the job being applied to.
     */
    @NotBlank(message = "jobId is required")
    @Pattern(regexp = UUID_PATTERN, message = "jobId must be a valid UUID")
    private String jobId;

    /**
     * S3 bucket name where the CV file is stored.
     */
    @NotBlank(message = "bucket is required")
    @Pattern(regexp = "^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", message = "bucket must be a valid S3 bucket name")
    private String bucket;

    /**
     * S3 object key (path) for the CV file.
     * Example: "cvs/2026/02/uuid.pdf"
     */
    @NotBlank(message = "fileKey is required")
    @Pattern(regexp = "^[a-zA-Z0-9/_.-]+$", message = "fileKey contains invalid characters")
    private String fileKey;

    /**
     * MIME type of the uploaded file.
     * Expected: "application/pdf" or "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
     */
    @NotBlank(message = "mimeType is required")
    private String mimeType;

    /**
     * Timestamp when the CV was uploaded.
     */
    @NotNull(message = "uploadedAt is required")
    private Instant uploadedAt;
}
