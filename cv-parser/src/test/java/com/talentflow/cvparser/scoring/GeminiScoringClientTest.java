package com.talentflow.cvparser.scoring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.shared.config.GeminiConfig;
import com.talentflow.cvparser.shared.exception.ScoringException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class GeminiScoringClientTest {

    private static final String INSTANCE_NAME = "geminiApi";
    private ObjectMapper objectMapper;
    private CandidateProfile profile;
    private String jobDescription;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        profile = CandidateProfile.builder()
                .fullName("Nguyen Van A")
                .email("a@example.com")
                .build();
        jobDescription = "Looking for a Senior Software Engineer";
    }

    @Test
    void callScoringApi_withSuccessfulResponse_shouldReturnScoreString() {
        ObjectNode response = objectMapper.createObjectNode();
        ArrayNode candidates = objectMapper.createArrayNode();
        ObjectNode candidate = objectMapper.createObjectNode();
        ObjectNode content = objectMapper.createObjectNode();
        ArrayNode parts = objectMapper.createArrayNode();
        ObjectNode part = objectMapper.createObjectNode();

        part.put("text", "85");
        parts.add(part);
        content.set("parts", parts);
        candidate.set("content", content);
        candidates.add(candidate);
        response.set("candidates", candidates);

        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.just(org.springframework.web.reactive.function.client.ClientResponse
                        .create(org.springframework.http.HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
                        .body(response.toString())
                        .build()))
                .build();

        GeminiScoringClient client = createClient(stubClient);

        StepVerifier.create(client.callScoringApi(profile, jobDescription))
                .expectNext("85")
                .verifyComplete();
    }

    @Test
    void callScoringApi_whenResponseIsEmpty_shouldThrowScoringException() {
        ObjectNode response = objectMapper.createObjectNode();
        response.set("candidates", objectMapper.createArrayNode());

        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.just(org.springframework.web.reactive.function.client.ClientResponse
                        .create(org.springframework.http.HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
                        .body(response.toString())
                        .build()))
                .build();

        GeminiScoringClient client = createClient(stubClient);

        StepVerifier.create(client.callScoringApi(profile, jobDescription))
                .expectErrorMatches(throwable -> throwable instanceof ScoringException ex
                        && "SCORING_NO_CANDIDATES".equals(ex.getErrorCode()))
                .verify();
    }

    @Test
    void callScoringApi_whenContentPartsAreMissing_shouldThrowScoringException() {
        ObjectNode response = objectMapper.createObjectNode();
        ArrayNode candidates = objectMapper.createArrayNode();
        ObjectNode candidate = objectMapper.createObjectNode();
        ObjectNode content = objectMapper.createObjectNode();
        content.set("parts", objectMapper.createArrayNode());
        candidate.set("content", content);
        candidates.add(candidate);
        response.set("candidates", candidates);

        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.just(org.springframework.web.reactive.function.client.ClientResponse
                        .create(org.springframework.http.HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
                        .body(response.toString())
                        .build()))
                .build();

        GeminiScoringClient client = createClient(stubClient);

        StepVerifier.create(client.callScoringApi(profile, jobDescription))
                .expectErrorMatches(throwable -> throwable instanceof ScoringException ex
                        && "SCORING_NO_PARTS".equals(ex.getErrorCode()))
                .verify();
    }

    @Test
    void callScoringApi_whenTextIsBlank_shouldThrowScoringException() {
        ObjectNode response = objectMapper.createObjectNode();
        ArrayNode candidates = objectMapper.createArrayNode();
        ObjectNode candidate = objectMapper.createObjectNode();
        ObjectNode content = objectMapper.createObjectNode();
        ArrayNode parts = objectMapper.createArrayNode();
        ObjectNode part = objectMapper.createObjectNode();

        part.put("text", "   ");
        parts.add(part);
        content.set("parts", parts);
        candidate.set("content", content);
        candidates.add(candidate);
        response.set("candidates", candidates);

        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.just(org.springframework.web.reactive.function.client.ClientResponse
                        .create(org.springframework.http.HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
                        .body(response.toString())
                        .build()))
                .build();

        GeminiScoringClient client = createClient(stubClient);

        StepVerifier.create(client.callScoringApi(profile, jobDescription))
                .expectErrorMatches(throwable -> throwable instanceof ScoringException ex
                        && "SCORING_BLANK_RESPONSE".equals(ex.getErrorCode()))
                .verify();
    }

    @Test
    void callScoringApi_whenClient4xxError_shouldMapToNonRetryableException() {
        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.error(WebClientResponseException.create(
                        400, "Bad Request",
                        HttpHeaders.EMPTY, "Invalid API Key".getBytes(), null)))
                .build();

        GeminiScoringClient client = createClient(stubClient);

        StepVerifier.create(client.callScoringApi(profile, jobDescription))
                .expectErrorMatches(throwable -> throwable instanceof ScoringException ex
                        && "SCORING_CLIENT_ERROR".equals(ex.getErrorCode())
                        && !ex.isRetryable())
                .verify();
    }

    @Test
    void callScoringApi_whenServer5xxError_shouldMapToRetryableExceptionAndRetry() {
        AtomicInteger callCount = new AtomicInteger(0);
        GeminiScoringClient client = clientWithAlwaysFailingWebClient(callCount, 2);

        StepVerifier.create(client.callScoringApi(profile, jobDescription))
                .expectErrorMatches(throwable -> throwable instanceof ScoringException ex
                        && "SCORING_SERVER_ERROR".equals(ex.getErrorCode())
                        && ex.isRetryable())
                .verify();

        assertThat(callCount.get()).isEqualTo(2);
    }

    @Test
    void callScoringApi_whenIOException_shouldMapToRetryableNetworkException() {
        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.error(new IOException("Connection refused")))
                .build();

        GeminiScoringClient client = createClient(stubClient);

        StepVerifier.create(client.callScoringApi(profile, jobDescription))
                .expectErrorMatches(throwable -> throwable instanceof ScoringException ex
                        && "SCORING_NETWORK_ERROR".equals(ex.getErrorCode())
                        && ex.isRetryable()
                        && ex.getCause() instanceof IOException)
                .verify();
    }

    private GeminiScoringClient createClient(WebClient webClient) {
        GeminiConfig geminiConfig = new GeminiConfig();
        ReflectionTestUtils.setField(geminiConfig, "apiKey", "test-key");
        ReflectionTestUtils.setField(geminiConfig, "baseUrl", "http://localhost");
        ReflectionTestUtils.setField(geminiConfig, "timeoutSeconds", 10);

        CircuitBreakerRegistry cbRegistry = CircuitBreakerRegistry.ofDefaults();
        RateLimiterRegistry rlRegistry = RateLimiterRegistry.ofDefaults();

        // Ensure "geminiApi" is registered
        cbRegistry.circuitBreaker(INSTANCE_NAME);
        rlRegistry.rateLimiter(INSTANCE_NAME);
        RetryRegistry retryRegistry = RetryRegistry.ofDefaults();

        return new GeminiScoringClientImpl(
                webClient, geminiConfig, "gemini-test", objectMapper,
                cbRegistry, rlRegistry, retryRegistry);
    }

    private GeminiScoringClient clientWithAlwaysFailingWebClient(AtomicInteger callCount, int maxAttempts) {
        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> {
                    callCount.incrementAndGet();
                    return Mono.error(WebClientResponseException.create(
                            500, "Internal Server Error",
                            HttpHeaders.EMPTY, new byte[0], null));
                })
                .build();

        GeminiConfig geminiConfig = new GeminiConfig();
        ReflectionTestUtils.setField(geminiConfig, "apiKey", "test-key");
        ReflectionTestUtils.setField(geminiConfig, "baseUrl", "http://localhost");
        ReflectionTestUtils.setField(geminiConfig, "timeoutSeconds", 1);

        RetryConfig retryConfig = RetryConfig.custom()
                .maxAttempts(maxAttempts)
                .waitDuration(Duration.ofMillis(10))
                .retryOnException(e -> e instanceof ScoringException ex && ex.isRetryable())
                .build();

        CircuitBreakerRegistry cbRegistry = CircuitBreakerRegistry.ofDefaults();
        cbRegistry.circuitBreaker(INSTANCE_NAME);

        RateLimiterRegistry rlRegistry = RateLimiterRegistry.of(
                Map.of(INSTANCE_NAME, RateLimiterConfig.custom()
                        .limitForPeriod(1000)
                        .limitRefreshPeriod(Duration.ofSeconds(1))
                        .timeoutDuration(Duration.ZERO)
                        .build()));

        RetryRegistry retryRegistry = RetryRegistry.of(Map.of(INSTANCE_NAME, retryConfig));

        return new GeminiScoringClientImpl(
                stubClient, geminiConfig, "gemini-test", objectMapper,
                cbRegistry, rlRegistry, retryRegistry);
    }
}
