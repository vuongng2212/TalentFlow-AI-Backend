package com.talentflow.cvparser.extractor;

import com.talentflow.cvparser.shared.config.GeminiConfig;
import com.talentflow.cvparser.shared.exception.ExtractionException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.decorators.Decorators;
import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeoutException;

/**
 * HTTP client for the Google Gemini generateContent API.
 *
 * Protected by Resilience4j: RateLimiter → CircuitBreaker → Retry.
 * 5xx and network errors are retried; 4xx errors surface immediately.
 */
@Slf4j
@Component
public class GeminiLlmClient {

    private static final String INSTANCE_NAME = "geminiApi";

    private final WebClient webClient;
    private final GeminiConfig geminiConfig;
    private final String model;
    private final int maxTokens;

    private final CircuitBreaker circuitBreaker;
    private final RateLimiter rateLimiter;
    private final Retry retry;

    public GeminiLlmClient(
            WebClient geminiWebClient,
            GeminiConfig geminiConfig,
            @Value("${llm.model:gemini-2.5-flash}") String model,
            @Value("${llm.max-tokens:8192}") int maxTokens,
            CircuitBreakerRegistry cbRegistry,
            RateLimiterRegistry rlRegistry,
            RetryRegistry retryRegistry) {

        this.webClient = geminiWebClient;
        this.geminiConfig = geminiConfig;
        this.model = model;
        this.maxTokens = maxTokens;

        this.circuitBreaker = cbRegistry.circuitBreaker(INSTANCE_NAME);
        this.rateLimiter = rlRegistry.rateLimiter(INSTANCE_NAME);

        // Build retry predicate on top of the YAML-configured instance so
        // max-attempts and wait-duration are still driven by application.yml.
        RetryConfig baseConfig = retryRegistry.getConfiguration(INSTANCE_NAME)
                .orElse(RetryConfig.ofDefaults());
        RetryConfig retryConfig = RetryConfig.from(baseConfig)
                .retryOnException(GeminiLlmClient::isRetryable)
                .build();
        this.retry = Retry.of(INSTANCE_NAME + "-client", retryConfig);
    }

    /**
     * Send a prompt to Gemini and return the raw text of the first candidate.
     *
     * @param prompt The complete prompt string (system + user, pre-assembled by the caller).
     * @return Raw text from Gemini — expected to be valid JSON matching cv-extraction-schema.json.
     * @throws ExtractionException on non-retryable errors (4xx, empty response).
     */
    public String generate(String prompt) {
        log.debug("[GEMINI] Request. model={}, promptLength={}", model, prompt.length());

        var decorated = Decorators.ofSupplier(() -> callGeminiApi(prompt))
                .withRateLimiter(rateLimiter)
                .withCircuitBreaker(circuitBreaker)
                .withRetry(retry)
                .decorate();

        String text = decorated.get();
        log.debug("[GEMINI] Response. responseLength={}", text.length());
        return text;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────────

    private String callGeminiApi(String prompt) {
        GeminiRequest request = new GeminiRequest(
                List.of(new Content("user", List.of(new Part(prompt)))),
                new GenerationConfig(0.1, maxTokens, "application/json")
        );

        try {
            GeminiResponse response = webClient.post()
                    .uri("/models/{model}:generateContent?key={key}",
                            model, geminiConfig.getApiKey())
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(GeminiResponse.class)
                    .timeout(geminiConfig.getTimeout())
                    .block();

            return extractText(response);

        } catch (WebClientResponseException e) {
            if (e.getStatusCode().is4xxClientError()) {
                // Do not retry — likely invalid API key or quota exhausted
                throw new ExtractionException(
                        "Gemini rejected request [" + e.getStatusCode() + "]: "
                                + e.getResponseBodyAsString(),
                        "GEMINI_CLIENT_ERROR", false, e);
            }
            // 5xx — retryable
            throw new ExtractionException(
                    "Gemini server error [" + e.getStatusCode() + "]: "
                            + e.getResponseBodyAsString(),
                    "GEMINI_SERVER_ERROR", true, e);

        } catch (ExtractionException e) {
            throw e;

        } catch (Exception e) {
            // Network failures, reactor TimeoutException wrapper, etc.
            Throwable root = unwrapCause(e);
            boolean retryable = root instanceof IOException || root instanceof TimeoutException;
            throw new ExtractionException(
                    "Gemini call failed: " + root.getMessage(),
                    "GEMINI_NETWORK_ERROR", retryable, e);
        }
    }

    private String extractText(GeminiResponse response) {
        if (response == null
                || response.candidates() == null
                || response.candidates().isEmpty()) {
            throw new ExtractionException("Empty Gemini response", "GEMINI_EMPTY_RESPONSE");
        }

        Content content = response.candidates().get(0).content();
        if (content == null || content.parts() == null || content.parts().isEmpty()) {
            throw new ExtractionException(
                    "Gemini response contains no content parts", "GEMINI_NO_CONTENT");
        }

        String text = content.parts().get(0).text();
        if (text == null || text.isBlank()) {
            throw new ExtractionException(
                    "Gemini returned blank text", "GEMINI_BLANK_RESPONSE");
        }
        return text.trim();
    }

    private static boolean isRetryable(Throwable e) {
        if (e instanceof ExtractionException ex) return ex.isRetryable();
        Throwable root = unwrapCause(e);
        return root instanceof IOException || root instanceof TimeoutException;
    }

    private static Throwable unwrapCause(Throwable e) {
        Throwable cause = e.getCause();
        return cause != null ? cause : e;
    }

    // ─── Request DTOs ─────────────────────────────────────────────────────────────

    record GeminiRequest(List<Content> contents, GenerationConfig generationConfig) {}

    record Content(String role, List<Part> parts) {}

    record Part(String text) {}

    record GenerationConfig(double temperature, int maxOutputTokens, String responseMimeType) {}

    // ─── Response DTOs ────────────────────────────────────────────────────────────

    record GeminiResponse(List<Candidate> candidates) {}

    record Candidate(Content content, String finishReason) {}
}
