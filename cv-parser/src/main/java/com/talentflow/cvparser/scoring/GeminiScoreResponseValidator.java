package com.talentflow.cvparser.scoring;
import org.springframework.stereotype.Component;

import com.talentflow.cvparser.shared.exception.ScoringException;
import lombok.extern.slf4j.Slf4j;

/**
 * Validates the raw score string returned by Gemini for the scoring prompt.
 * Expects an integer in [0, 100]. Throws {@link ScoringException} on invalid input.
 */
@Slf4j
@Component
public class GeminiScoreResponseValidator {

    private static final String NAN_MESSAGE = "Score must be an integer";
    private static final String RANGE_MESSAGE = "Score must be between 0 and 100";

    /**
     * Validates and parses a score string.
     *
     * @param scoreResponse Raw text from Gemini scoring response
     * @return Parsed integer score in [0, 100]
     * @throws ScoringException if the response is null, blank, non-integer, or out of range
     */
    public int validate(String scoreResponse) {
        if (scoreResponse == null || scoreResponse.isBlank()) {
            throw new ScoringException("Score response is null or blank", "SCORE_INVALID_RESPONSE", false);
        }

        String trimmed = scoreResponse.trim();
        int score;
        try {
            score = Integer.parseInt(trimmed);
        } catch (NumberFormatException e) {
            log.warn("[SCORE-VALIDATOR] Non-integer score response: {}", trimmed);
            throw new ScoringException(NAN_MESSAGE, "SCORE_NON_INTEGER", false, e);
        }

        if (score < 0 || score > 100) {
            log.warn("[SCORE-VALIDATOR] Score out of range: {}", score);
            throw new ScoringException(RANGE_MESSAGE, "SCORE_OUT_OF_RANGE", false);
        }

        log.debug("[SCORE-VALIDATOR] Score validated: {}", score);
        return score;
    }
}
