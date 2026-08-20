package com.talentflow.cvparser.scoring;

import com.talentflow.cvparser.extractor.CandidateProfile;
import reactor.core.publisher.Mono;

/**
 * Makes Gemini API calls specifically for candidate scoring.
 * Reuses the existing {@code geminiApi} Resilience4j instance (circuit breaker, rate limiter, retry).
 */
public interface GeminiScoringClient {

    /**
     * Calls Gemini with a scoring-specific prompt.
     *
     * @param profile        The candidate's extracted profile
     * @param jobDescription The job requirements text
     * @return Mono emitting the raw score text from Gemini (e.g., "85")
     */
    Mono<String> callScoringApi(CandidateProfile profile, String jobDescription);
}
