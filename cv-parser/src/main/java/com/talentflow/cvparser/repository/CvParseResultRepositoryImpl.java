package com.talentflow.cvparser.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.scoring.ScoringResult;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.shared.dto.ParseStatus;
import com.talentflow.cvparser.shared.dto.ScoringStatus;
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
    public void save(CvUploadedEvent event, CandidateProfile profile, ScoringResult scoring) {
        String parsedDataJson = serializeParsedData(profile);
        Optional<CvParseResultEntity> existing = jpaRepository.findByApplicationId(
                UUID.fromString(event.getApplicationId()));

        CvParseResultEntity entity;
        if (existing.isPresent()) {
            entity = existing.get();
            entity.setStatus(ParseStatus.SUCCESS);
            entity.setAiScore(scoring != null ? scoring.getAiScore() : null);
            entity.setScoringReasoning(scoring != null ? scoring.getScoringReasoning() : null);
            entity.setScoringStatus(scoring != null ? scoring.getScoringStatus() : null);
            entity.setParsedData(parsedDataJson);
        } else {
            entity = CvParseResultEntity.builder()
                    .applicationId(UUID.fromString(event.getApplicationId()))
                    .candidateId(UUID.fromString(event.getCandidateId()))
                    .jobId(UUID.fromString(event.getJobId()))
                    .status(ParseStatus.SUCCESS)
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
