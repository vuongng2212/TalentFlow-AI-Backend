package com.talentflow.cvparser.shared.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

/**
 * Google Gemini LLM client configuration.
 *
 * Uses environment variables:
 *   - GEMINI_API_KEY: API key for authentication
 *   - LLM_MODEL: Model name (default: gemini-2.5-flash)
 *   - LLM_TIMEOUT_SECONDS: Request timeout
 */
@Configuration
public class GeminiConfig {

    @Value("${llm.api-key:}")
    private String apiKey;

    @Value("${llm.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String baseUrl;

    @Value("${llm.model:gemini-2.5-flash}")
    private String model;

    @Value("${llm.timeout-seconds:30}")
    private int timeoutSeconds;

    /**
     * WebClient configured for Gemini API calls.
     * Includes API key in query parameters and appropriate headers.
     */
    @Bean
    public WebClient geminiWebClient() {
        return WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    /**
     * Get the configured model name.
     */
    @Bean
    public String geminiModel() {
        return model;
    }

    /**
     * Get the API key.
     * Returns empty string if not configured (for testing).
     */
    public String getApiKey() {
        return apiKey;
    }

    /**
     * Get the request timeout duration.
     */
    public Duration getTimeout() {
        return Duration.ofSeconds(timeoutSeconds);
    }
}
