package com.talentflow.cvparser.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.scoring.ScoringResult;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.shared.dto.ParseStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * JPA-backed repository for CV parse results.
 * Persists results to the {@code cv_parser.cv_parse_results} table via Flyway + JPA.
 */
@Slf4j
@Repository
public class CvParseResultRepositoryImpl implements CvParseResultRepository {

    private final CvParseResultJpaRepository jpaRepository;
    private final ObjectMapper objectMapper;

    public CvParseResultRepositoryImpl(CvParseResultJpaRepository jpaRepository, ObjectMapper objectMapper) {
        this.jpaRepository = jpaRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void save(CvUploadedEvent event, CandidateProfile profile, ScoringResult scoring, ParseStatus status) {
        String parsedDataJson = serializeParsedData(profile);
        Optional<CvParseResultEntity> existing = jpaRepository.findByApplicationId(
                UUID.fromString(event.getApplicationId()));

        CvParseResultEntity entity;
        if (existing.isPresent()) {
            entity = existing.get();
            // Persist the real status instead of always SUCCESS, so idempotency,
            // metrics and auditing reflect PARTIAL / FAILED outcomes too.
            entity.setStatus(status);
            entity.setAiScore(scoring != null ? scoring.getAiScore() : null);
            entity.setScoringReasoning(scoring != null ? scoring.getScoringReasoning() : null);
            entity.setScoringStatus(scoring != null ? scoring.getScoringStatus() : null);
            entity.setParsedData(parsedDataJson);
            entity.setErrorMessage(null);
            entity.setErrorCode(null);
        } else {
            entity = CvParseResultEntity.builder()
                    .applicationId(UUID.fromString(event.getApplicationId()))
                    .candidateId(UUID.fromString(event.getCandidateId()))
                    .jobId(UUID.fromString(event.getJobId()))
                    .status(status)
                    .aiScore(scoring != null ? scoring.getAiScore() : null)
                    .scoringReasoning(scoring != null ? scoring.getScoringReasoning() : null)
                    .scoringStatus(scoring != null ? scoring.getScoringStatus() : null)
                    .parsedData(parsedDataJson)
                    .build();
        }

        jpaRepository.save(entity);
        log.debug("[REPO] Saved CvParseResult. applicationId={}, status={}, score={}",
                event.getApplicationId(), entity.getStatus(), entity.getAiScore());
    }

    @Override
    public void saveFailure(CvUploadedEvent event, ParseStatus status, String errorMessage) {
        // Don't overwrite a prior SUCCESS — a later transient failure on retry must not
        // downgrade an already-completed record.
        if (jpaRepository.existsByApplicationIdAndStatus(
                UUID.fromString(event.getApplicationId()), ParseStatus.SUCCESS)) {
            log.debug("[REPO] Skipping failure save; SUCCESS row already present. applicationId={}",
                    event.getApplicationId());
            return;
        }

        Optional<CvParseResultEntity> existing = jpaRepository.findByApplicationId(
                UUID.fromString(event.getApplicationId()));
        CvParseResultEntity entity;
        if (existing.isPresent()) {
            entity = existing.get();
            entity.setStatus(status);
            entity.setErrorMessage(errorMessage);
        } else {
            entity = CvParseResultEntity.builder()
                    .applicationId(UUID.fromString(event.getApplicationId()))
                    .candidateId(UUID.fromString(event.getCandidateId()))
                    .jobId(UUID.fromString(event.getJobId()))
                    .status(status)
                    .errorMessage(errorMessage)
                    .build();
        }

        jpaRepository.save(entity);
        log.debug("[REPO] Saved FAILED/PARTIAL CvParseResult. applicationId={}, status={}",
                event.getApplicationId(), status);
    }

    @Override
    public boolean existsByApplicationIdAndStatus(String applicationId, ParseStatus status) {
        return jpaRepository.existsByApplicationIdAndStatus(
                UUID.fromString(applicationId), status);
    }

    private String serializeParsedData(CandidateProfile profile) {
        try {
            return objectMapper.writeValueAsString(profile);
        } catch (JsonProcessingException e) {
            log.warn("[REPO] Failed to serialize parsed data", e);
            return "{}";
        }
    }
}
