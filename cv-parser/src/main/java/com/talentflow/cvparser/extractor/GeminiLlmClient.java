package com.talentflow.cvparser.extractor;

import com.talentflow.cvparser.shared.config.GeminiConfig;
import com.talentflow.cvparser.shared.exception.ExtractionException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.reactor.circuitbreaker.operator.CircuitBreakerOperator;
import io.github.resilience4j.reactor.ratelimiter.operator.RateLimiterOperator;
import io.github.resilience4j.reactor.retry.RetryOperator;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.io.IOException;
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
     * Send a two-part prompt to Gemini and return the raw text of the first candidate.
     *
     * @param prompt Built by {@link PromptBuilder}; carries system instruction and user CV text.
     * @return Mono emitting the raw text from Gemini — expected to be valid JSON matching
     *         cv-extraction-schema.json — or erroring with {@link ExtractionException} on
     *         non-retryable errors (4xx, empty response).
     */
    public Mono<String> generate(CvExtractionPrompt prompt) {
        log.debug("[GEMINI] Request. model={}, systemLength={}, userLength={}",
                model, prompt.systemInstruction().length(), prompt.userContent().length());

        // Decoration order — innermost first → outermost last:
        // RateLimiter (innermost) → CircuitBreaker → Retry (outermost).
        // Each retry attempt thus passes through the CB and rate limit again.
        return callGeminiApi(prompt)
                .map(this::extractText)
                .transformDeferred(RateLimiterOperator.of(rateLimiter))
                .transformDeferred(CircuitBreakerOperator.of(circuitBreaker))
                .transformDeferred(RetryOperator.of(retry))
                .doOnSuccess(text -> log.debug("[GEMINI] Response. responseLength={}", text.length()));
    }


    private Mono<GeminiResponse> callGeminiApi(CvExtractionPrompt prompt) {
        GeminiRequest request = new GeminiRequest(
                new SystemInstruction(List.of(new Part(prompt.systemInstruction()))),
                List.of(new Content("user", List.of(new Part(prompt.userContent())))),
                new GenerationConfig(0.1, maxTokens, "application/json")
        );

        return webClient.post()
                .uri("/models/{model}:generateContent?key={key}",
                        model, geminiConfig.getApiKey())
                .bodyValue(request)
                .retrieve()
                .bodyToMono(GeminiResponse.class)
                .timeout(geminiConfig.getTimeout())
                .onErrorMap(this::mapError);
    }

    private Throwable mapError(Throwable e) {
        if (e instanceof ExtractionException) {
            return e;
        }

        if (e instanceof WebClientResponseException wcre) {
            if (wcre.getStatusCode().is4xxClientError()) {
                // Do not retry — likely invalid API key or quota exhausted
                return new ExtractionException(
                        "Gemini rejected request [" + wcre.getStatusCode() + "]: "
                                + wcre.getResponseBodyAsString(),
                        "GEMINI_CLIENT_ERROR", false, wcre);
            }
            // 5xx — retryable
            return new ExtractionException(
                    "Gemini server error [" + wcre.getStatusCode() + "]: "
                            + wcre.getResponseBodyAsString(),
                    "GEMINI_SERVER_ERROR", true, wcre);
        }

        // Network failures, reactor timeout, etc.
        boolean retryable = e instanceof IOException || e instanceof TimeoutException;
        return new ExtractionException(
                "Gemini call failed: " + e.getMessage(),
                "GEMINI_NETWORK_ERROR", retryable, e);
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
        return e instanceof ExtractionException ex && ex.isRetryable();
    }

    record GeminiRequest(
            SystemInstruction systemInstruction,
            List<Content> contents,
            GenerationConfig generationConfig) {}

    record SystemInstruction(List<Part> parts) {}

    record Content(String role, List<Part> parts) {}

    record Part(String text) {}

    record GenerationConfig(double temperature, int maxOutputTokens, String responseMimeType) {}

    record GeminiResponse(List<Candidate> candidates) {}

    record Candidate(Content content, String finishReason) {}
}
