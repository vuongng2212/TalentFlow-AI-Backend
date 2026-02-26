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
 * Event published when CV parsing fails.
 * Published to talentflow.events exchange with routing key cv.failed.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CvFailedEvent {

    private static final String UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    /**
     * UUID of the candidate.
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
     * UUID of the job.
     */
    @NotBlank(message = "jobId is required")
    @Pattern(regexp = UUID_PATTERN, message = "jobId must be a valid UUID")
    private String jobId;

    /**
     * Error code for categorization.
     * Examples: PARSING_FAILED, EXTRACTION_FAILED, SCORING_FAILED, FILE_NOT_FOUND
     */
    @NotBlank(message = "errorCode is required")
    @Pattern(regexp = "^[A-Z_]+$", message = "errorCode must be uppercase with underscores")
    private String errorCode;

    /**
     * Human-readable error message.
     * Should NOT contain sensitive information or stack traces.
     */
    @NotBlank(message = "errorMessage is required")
    private String errorMessage;

    /**
     * Whether the operation can be retried.
     * false for permanent failures (invalid file, unsupported format)
     * true for transient failures (API timeout, service unavailable)
     */
    @NotNull(message = "retryable is required")
    private Boolean retryable;

    /**
     * Timestamp when failure occurred.
     */
    @NotNull(message = "failedAt is required")
    private Instant failedAt;
}
