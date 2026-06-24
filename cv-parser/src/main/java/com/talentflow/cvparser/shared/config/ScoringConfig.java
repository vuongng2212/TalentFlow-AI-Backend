package com.talentflow.cvparser.shared.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration properties for AI scoring.
 * Prefix: {@code llm.scoring}
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "llm.scoring")
public class ScoringConfig {

    /**
     * Timeout in seconds for the Gemini scoring API call.
     */
    private int timeoutSeconds = 10;

    /**
     * Fallback score when Gemini is unavailable or returns invalid data.
     */
    private int fallbackScore = 50;

    /**
     * Fallback reasoning text when Gemini is unavailable.
     */
    private String fallbackReason = "Scoring unavailable";

    /**
     * Maximum retry attempts for the scoring API call.
     */
    private int maxRetries = 2;
}
