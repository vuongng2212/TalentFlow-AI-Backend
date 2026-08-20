package com.talentflow.cvparser.repository;

import com.talentflow.cvparser.shared.dto.ParseStatus;
import com.talentflow.cvparser.shared.dto.ScoringStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * JPA entity mapping to the {@code cv_parser.cv_parse_results} table.
 * Stores the outcome of a single CV processing attempt.
 */
@Entity
@Table(name = "cv_parse_results", schema = "cv_parser")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CvParseResultEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "application_id", nullable = false, unique = true)
    private UUID applicationId;

    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ParseStatus status;

    @Column(name = "ai_score")
    private Integer aiScore;

    @Column(name = "scoring_reasoning", columnDefinition = "TEXT")
    private String scoringReasoning;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_status", length = 16)
    private ScoringStatus scoringStatus;

    @Column(name = "parsed_data", columnDefinition = "JSONB")
    private String parsedData;  // JSON string, serialized by Jackson

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
