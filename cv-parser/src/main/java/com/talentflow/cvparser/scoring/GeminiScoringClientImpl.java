package com.talentflow.cvparser.scoring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.shared.config.GeminiConfig;
import com.talentflow.cvparser.shared.exception.ScoringException;
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
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeoutException;

/**
 * Gemini API client specifically for the candidate scoring use case.
 *
 * <p>Reuses the existing {@code geminiApi} Resilience4j instance (circuit breaker, rate limiter, retry)
 * and the shared {@link WebClient} configured in {@link GeminiConfig}.
 */
@Slf4j
@Component
public class GeminiScoringClientImpl implements GeminiScoringClient {

    private static final String INSTANCE_NAME = "geminiApi";
    private static final String SCORING_SYSTEM_INSTRUCTION = """
            You are a hiring assistant that evaluates CVs against job descriptions.
            Return ONLY a single integer between 0 and 100 representing the match score.
            No explanation, no formatting, just the number.
            """;

    private final WebClient webClient;
    private final GeminiConfig geminiConfig;
    private final String model;
    private final ObjectMapper objectMapper;

    private final CircuitBreaker circuitBreaker;
    private final RateLimiter rateLimiter;
    private final Retry retry;

    public GeminiScoringClientImpl(
            WebClient geminiWebClient,
            GeminiConfig geminiConfig,
            @org.springframework.beans.factory.annotation.Value("${llm.model:gemini-2.5-flash}") String model,
            ObjectMapper objectMapper,
            CircuitBreakerRegistry cbRegistry,
            RateLimiterRegistry rlRegistry,
            RetryRegistry retryRegistry) {

        this.webClient = geminiWebClient;
        this.geminiConfig = geminiConfig;
        this.model = model;
        this.objectMapper = objectMapper;

        this.circuitBreaker = cbRegistry.circuitBreaker(INSTANCE_NAME);
        this.rateLimiter = rlRegistry.rateLimiter(INSTANCE_NAME);

        RetryConfig baseConfig = retryRegistry.getConfiguration(INSTANCE_NAME)
                .orElse(RetryConfig.ofDefaults());
        RetryConfig retryConfig = RetryConfig.from(baseConfig)
                .retryOnException(GeminiScoringClientImpl::isRetryable)
                .build();
        this.retry = Retry.of(INSTANCE_NAME + "-scoring", retryConfig);
    }

    @Override
    public Mono<String> callScoringApi(CandidateProfile profile, String jobDescription) {
        String userPrompt = buildScoringPrompt(profile, jobDescription);

        log.debug("[SCORE-GEMINI] Request. model={}, profileLength={}, jdLength={}",
                model, profile.toString().length(), jobDescription.length());

        return callGeminiApi(userPrompt)
                .map(this::extractText)
                .transformDeferred(RateLimiterOperator.of(rateLimiter))
                .transformDeferred(CircuitBreakerOperator.of(circuitBreaker))
                .transformDeferred(RetryOperator.of(retry))
                .doOnSuccess(text -> log.debug("[SCORE-GEMINI] Response: {}", text));
    }

    private Mono<JsonNode> callGeminiApi(String userPrompt) {
        ObjectNode request = objectMapper.createObjectNode();
        request.set("system_instruction", objectMapper.createObjectNode()
                .set("parts", objectMapper.createArrayNode()
                        .add(objectMapper.createObjectNode().put("text", SCORING_SYSTEM_INSTRUCTION))));
        ArrayNode contents = objectMapper.createArrayNode();
        ObjectNode content = objectMapper.createObjectNode();
        content.put("role", "user");
        ArrayNode parts = objectMapper.createArrayNode();
        parts.add(objectMapper.createObjectNode().put("text", userPrompt));
        content.set("parts", parts);
        contents.add(content);
        request.set("contents", contents);
        ObjectNode generationConfig = objectMapper.createObjectNode();
        generationConfig.put("temperature", 0.1);
        generationConfig.put("maxOutputTokens", 20);
        generationConfig.put("responseMimeType", "text/plain");
        request.set("generationConfig", generationConfig);

        return webClient.post()
                .uri("/models/{model}:generateContent?key={key}",
                        model, geminiConfig.getApiKey())
                .bodyValue(request)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(Duration.ofSeconds(geminiConfig.getTimeout().getSeconds()))
                .onErrorMap(this::mapError);
    }

    private Throwable mapError(Throwable e) {
        if (e instanceof ScoringException) {
            return e;
        }

        if (e instanceof WebClientResponseException wcre) {
            if (wcre.getStatusCode().is4xxClientError()) {
                return new ScoringException(
                        "Gemini rejected scoring request [" + wcre.getStatusCode() + "]: "
                                + wcre.getResponseBodyAsString(),
                        "SCORING_CLIENT_ERROR", false, wcre);
            }
            return new ScoringException(
                    "Gemini server error during scoring [" + wcre.getStatusCode() + "]: "
                            + wcre.getResponseBodyAsString(),
                    "SCORING_SERVER_ERROR", true, wcre);
        }

        boolean retryable = e instanceof IOException || e instanceof TimeoutException;
        return new ScoringException(
                "Gemini scoring call failed: " + e.getMessage(),
                "SCORING_NETWORK_ERROR", retryable, e);
    }

    private String extractText(JsonNode response) {
        if (response == null) {
            throw new ScoringException("Empty Gemini scoring response", "SCORING_EMPTY_RESPONSE");
        }

        JsonNode candidates = response.get("candidates");
        if (candidates == null || candidates.isEmpty()) {
            throw new ScoringException("Gemini scoring response contains no candidates", "SCORING_NO_CANDIDATES");
        }

        JsonNode content = candidates.get(0).get("content");
        if (content == null) {
            throw new ScoringException("Gemini scoring response has no content", "SCORING_NO_CONTENT");
        }

        JsonNode parts = content.get("parts");
        if (parts == null || parts.isEmpty()) {
            throw new ScoringException("Gemini scoring response has no content parts", "SCORING_NO_PARTS");
        }

        String text = parts.get(0).get("text").asText();
        if (text == null || text.isBlank()) {
            throw new ScoringException("Gemini returned blank scoring text", "SCORING_BLANK_RESPONSE");
        }
        return text.trim();
    }

    private String buildScoringPrompt(CandidateProfile profile, String jobDescription) {
        StringBuilder sb = new StringBuilder();
        sb.append("Job Description:\n").append(jobDescription).append("\n\n");
        sb.append("Candidate Profile:\n");
        sb.append("Name: ").append(profile.getFullName()).append("\n");
        sb.append("Skills: ").append(profile.getSkills() != null
                ? String.join(", ", profile.getSkills()) : "N/A").append("\n");
        sb.append("Years of Experience: ").append(profile.getYearsOfExperience() != null
                ? profile.getYearsOfExperience() : "N/A").append("\n");
        if (profile.getExperience() != null && !profile.getExperience().isEmpty()) {
            sb.append("Work Experience:\n");
            for (var exp : profile.getExperience()) {
                sb.append("  - ").append(exp.getTitle()).append(" at ").append(exp.getCompany());
                if (exp.getStartDate() != null) {
                    sb.append(" (").append(exp.getStartDate());
                    if (exp.getEndDate() != null) {
                        sb.append(" to ").append(exp.getEndDate());
                    } else {
                        sb.append(" to Present");
                    }
                    sb.append(")");
                }
                sb.append("\n");
            }
        }
        if (profile.getEducation() != null && !profile.getEducation().isEmpty()) {
            sb.append("Education:\n");
            for (var edu : profile.getEducation()) {
                sb.append("  - ").append(edu.getDegree()).append(", ").append(edu.getInstitution());
                if (edu.getGraduationYear() != null) {
                    sb.append(" (").append(edu.getGraduationYear()).append(")");
                }
                sb.append("\n");
            }
        }
        sb.append("\nReturn ONLY a single integer score between 0 and 100 representing the match quality.");
        return sb.toString();
    }

    private static boolean isRetryable(Throwable e) {
        return e instanceof ScoringException ex && ex.isRetryable();
    }
}
