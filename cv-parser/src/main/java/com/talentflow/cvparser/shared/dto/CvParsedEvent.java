package com.talentflow.cvparser.shared.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Event published when a CV is successfully parsed and scored.
 * Published to talentflow.events exchange with routing key cv.parsed.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CvParsedEvent {

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
     * AI-generated score (0-100) based on job requirements match.
     */
    @NotNull(message = "aiScore is required")
    @Min(value = 0, message = "aiScore must be between 0 and 100")
    @Max(value = 100, message = "aiScore must be between 0 and 100")
    private Integer aiScore;

    /**
     * Extracted structured data from the CV.
     */
    @NotNull(message = "parsedData is required")
    @Valid
    private ParsedCvData parsedData;

    /**
     * AI reasoning for the score.
     */
    private String scoringReasoning;

    /**
     * Timestamp when parsing completed.
     */
    @NotNull(message = "parsedAt is required")
    private Instant parsedAt;
}
