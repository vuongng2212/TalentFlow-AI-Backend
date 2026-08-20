package com.talentflow.cvparser.scoring;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.shared.config.ScoringConfig;
import com.talentflow.cvparser.shared.dto.ScoringStatus;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Scores a candidate's extracted profile against a job description using Gemini.
 *
 * <p>Behaviour by scenario:
 * <ul>
 *   <li>Job description is null/empty → {@link ScoringStatus#SKIPPED} with aiScore=0</li>
 *   <li>Gemini returns a valid 0-100 score → {@link ScoringStatus#SUCCESS}</li>
 *   <li>Gemini throws or returns invalid data → {@link ScoringStatus#FALLBACK} with configured fallback score</li>
 * </ul>
 *
 * Always returns a non-null {@link ScoringResult} — never throws.
 */
@Slf4j
@Service
public class CandidateScoringService implements CandidateScoringUseCase {

    private static final String METRIC_NAME = "gemini_api_calls_total";
    private static final String TAG_TYPE = "type";
    private static final String TAG_OUTCOME = "outcome";
    private static final String TYPE_SCORING = "scoring";

    private final GeminiScoringClient scoringClient;
    private final GeminiScoreResponseValidator validator;
    private final ScoringConfig scoringConfig;

    private final Counter successCounter;
    private final Counter fallbackCounter;
    private final Counter errorCounter;

    public CandidateScoringService(
            GeminiScoringClient scoringClient,
            GeminiScoreResponseValidator validator,
            ScoringConfig scoringConfig,
            MeterRegistry meterRegistry) {
        this.scoringClient = scoringClient;
        this.validator = validator;
        this.scoringConfig = scoringConfig;

        this.successCounter = Counter.builder(METRIC_NAME)
                .tag(TAG_TYPE, TYPE_SCORING)
                .tag(TAG_OUTCOME, "success")
                .register(meterRegistry);
        this.fallbackCounter = Counter.builder(METRIC_NAME)
                .tag(TAG_TYPE, TYPE_SCORING)
                .tag(TAG_OUTCOME, "fallback")
                .register(meterRegistry);
        this.errorCounter = Counter.builder(METRIC_NAME)
                .tag(TAG_TYPE, TYPE_SCORING)
                .tag(TAG_OUTCOME, "error")
                .register(meterRegistry);
    }

    @Override
    public ScoringResult score(CandidateProfile candidateProfile, String jobDescription) {
        // SKIPPED path: no job description to score against
        if (jobDescription == null || jobDescription.isBlank()) {
            log.debug("[SCORE] Job description is null/blank — scoring SKIPPED");
            return ScoringResult.builder()
                    .aiScore(0)
                    .scoringReasoning(null)
                    .scoringStatus(ScoringStatus.SKIPPED)
                    .build();
        }

        try {
            String rawScore = scoringClient.callScoringApi(candidateProfile, jobDescription).block();
            int aiScore = validator.validate(rawScore);

            log.info("[SCORE] Success. score={}", aiScore);
            successCounter.increment();
            return ScoringResult.builder()
                    .aiScore(aiScore)
                    .scoringReasoning(buildReasoning(aiScore))
                    .scoringStatus(ScoringStatus.SUCCESS)
                    .build();

        } catch (Exception e) {
            log.warn("[SCORE] Gemini scoring failed, using fallback. reason={}", e.getMessage());

            // Classify the error outcome for metrics
            if (e instanceof com.talentflow.cvparser.shared.exception.ScoringException) {
                fallbackCounter.increment();
            } else {
                errorCounter.increment();
            }

            return ScoringResult.builder()
                    .aiScore(scoringConfig.getFallbackScore())
                    .scoringReasoning(scoringConfig.getFallbackReason())
                    .scoringStatus(ScoringStatus.FALLBACK)
                    .build();
        }
    }

    /**
     * Build a simple reasoning string from the score value.
     * In a full implementation this would come from Gemini's reasoning field.
     */
    private String buildReasoning(int aiScore) {
        if (aiScore >= 80) {
            return "Strong match: profile aligns well with job requirements.";
        } else if (aiScore >= 60) {
            return "Moderate match: profile partially meets job requirements.";
        } else if (aiScore >= 40) {
            return "Fair match: profile meets some job requirements.";
        } else {
            return "Weak match: profile has limited alignment with job requirements.";
        }
    }
}
