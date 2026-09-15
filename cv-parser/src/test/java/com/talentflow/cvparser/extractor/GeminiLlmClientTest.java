package com.talentflow.cvparser.extractor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talentflow.cvparser.shared.config.GeminiConfig;
import com.talentflow.cvparser.shared.exception.ExtractionException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class GeminiLlmClientTest {

    private static final String INSTANCE_NAME = "geminiApi";

    @Test
    void retryExhaustsExactlyMaxAttemptsThenFails() {
        // Worst-case total LLM latency = maxAttempts × perCallTimeout + (maxAttempts-1) × waitDuration.
        // Old config (maxAttempts=3, timeout=30s): 3×30 + 2×2 = 94s — blows the 10s target.
        // New config (maxAttempts=2, timeout=8s):  2×8  + 1×2 = 18s — within budget.
        // This test fails at maxAttempts=3 (actual calls=3, expected=2) and passes at maxAttempts=2.
        int maxAttempts   = 2;
        int expectedCalls = 2;

        AtomicInteger callCount = new AtomicInteger(0);
        GeminiLlmClient client  = clientWithAlwaysFailingWebClient(callCount, maxAttempts);

        StepVerifier.create(client.generate(new CvExtractionPrompt("system", "cv text")))
                .expectError()
                .verify(Duration.ofSeconds(10));

        assertThat(callCount.get())
                .as("with maxAttempts=%d, client must make exactly %d HTTP call(s), not %d",
                        expectedCalls, expectedCalls, maxAttempts)
                .isEqualTo(expectedCalls);
    }

    @Test
    void generate_withSuccessfulResponse_shouldReturnTrimmedText() {
        GeminiLlmClient.Part part = new GeminiLlmClient.Part("   Extracted Text   ");
        GeminiLlmClient.Content content = new GeminiLlmClient.Content("model", List.of(part));
        GeminiLlmClient.Candidate candidate = new GeminiLlmClient.Candidate(content, "STOP");
        GeminiLlmClient.GeminiResponse responseObj = new GeminiLlmClient.GeminiResponse(List.of(candidate));

        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.just(org.springframework.web.reactive.function.client.ClientResponse
                        .create(org.springframework.http.HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
                        .body(new ObjectMapper().valueToTree(responseObj).toString())
                        .build()))
                .build();

        GeminiLlmClient client = createClient(stubClient);

        StepVerifier.create(client.generate(new CvExtractionPrompt("system", "cv text")))
                .expectNext("Extracted Text")
                .verifyComplete();
    }

    @Test
    void generate_whenResponseIsEmpty_shouldThrowExtractionException() {
        GeminiLlmClient.GeminiResponse responseObj = new GeminiLlmClient.GeminiResponse(List.of());

        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.just(org.springframework.web.reactive.function.client.ClientResponse
                        .create(org.springframework.http.HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
                        .body(new ObjectMapper().valueToTree(responseObj).toString())
                        .build()))
                .build();

        GeminiLlmClient client = createClient(stubClient);

        StepVerifier.create(client.generate(new CvExtractionPrompt("system", "cv text")))
                .expectErrorMatches(throwable -> throwable instanceof ExtractionException ex
                        && "GEMINI_EMPTY_RESPONSE".equals(ex.getErrorCode())
                        && !ex.isRetryable())
                .verify();
    }

    @Test
    void generate_whenContentPartsAreMissing_shouldThrowExtractionException() {
        GeminiLlmClient.Content content = new GeminiLlmClient.Content("model", List.of());
        GeminiLlmClient.Candidate candidate = new GeminiLlmClient.Candidate(content, "STOP");
        GeminiLlmClient.GeminiResponse responseObj = new GeminiLlmClient.GeminiResponse(List.of(candidate));

        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.just(org.springframework.web.reactive.function.client.ClientResponse
                        .create(org.springframework.http.HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
                        .body(new ObjectMapper().valueToTree(responseObj).toString())
                        .build()))
                .build();

        GeminiLlmClient client = createClient(stubClient);

        StepVerifier.create(client.generate(new CvExtractionPrompt("system", "cv text")))
                .expectErrorMatches(throwable -> throwable instanceof ExtractionException ex
                        && "GEMINI_NO_CONTENT".equals(ex.getErrorCode())
                        && !ex.isRetryable())
                .verify();
    }

    @Test
    void generate_whenTextIsBlank_shouldThrowExtractionException() {
        GeminiLlmClient.Part part = new GeminiLlmClient.Part("   ");
        GeminiLlmClient.Content content = new GeminiLlmClient.Content("model", List.of(part));
        GeminiLlmClient.Candidate candidate = new GeminiLlmClient.Candidate(content, "STOP");
        GeminiLlmClient.GeminiResponse responseObj = new GeminiLlmClient.GeminiResponse(List.of(candidate));

        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.just(org.springframework.web.reactive.function.client.ClientResponse
                        .create(org.springframework.http.HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
                        .body(new ObjectMapper().valueToTree(responseObj).toString())
                        .build()))
                .build();

        GeminiLlmClient client = createClient(stubClient);

        StepVerifier.create(client.generate(new CvExtractionPrompt("system", "cv text")))
                .expectErrorMatches(throwable -> throwable instanceof ExtractionException ex
                        && "GEMINI_BLANK_RESPONSE".equals(ex.getErrorCode())
                        && !ex.isRetryable())
                .verify();
    }

    @Test
    void generate_whenClient4xxError_shouldMapToNonRetryableException() {
        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.error(WebClientResponseException.create(
                        400, "Bad Request",
                        HttpHeaders.EMPTY, "Invalid API Key".getBytes(), null)))
                .build();

        GeminiLlmClient client = createClient(stubClient);

        StepVerifier.create(client.generate(new CvExtractionPrompt("system", "cv text")))
                .expectErrorMatches(throwable -> throwable instanceof ExtractionException ex
                        && "GEMINI_CLIENT_ERROR".equals(ex.getErrorCode())
                        && !ex.isRetryable())
                .verify();
    }

    @Test
    void generate_whenServer5xxError_shouldMapToRetryableExceptionAndRetry() {
        AtomicInteger callCount = new AtomicInteger(0);
        GeminiLlmClient client = clientWithAlwaysFailingWebClient(callCount, 2);

        StepVerifier.create(client.generate(new CvExtractionPrompt("system", "cv text")))
                .expectErrorMatches(throwable -> throwable instanceof ExtractionException ex
                        && "GEMINI_SERVER_ERROR".equals(ex.getErrorCode())
                        && ex.isRetryable())
                .verify();
    }

    @Test
    void generate_whenIOException_shouldMapToRetryableNetworkException() {
        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.error(new IOException("Connection refused")))
                .build();

        GeminiLlmClient client = createClient(stubClient);

        StepVerifier.create(client.generate(new CvExtractionPrompt("system", "cv text")))
                .expectErrorMatches(throwable -> throwable instanceof ExtractionException ex
                        && "GEMINI_NETWORK_ERROR".equals(ex.getErrorCode())
                        && ex.isRetryable()
                        && ex.getCause() instanceof IOException)
                .verify();
    }

    @Test
    void generate_whenGeneralException_shouldMapToNonRetryableNetworkException() {
        WebClient stubClient = WebClient.builder()
                .baseUrl("http://localhost")
                .exchangeFunction(request -> Mono.error(new RuntimeException("Something went wrong")))
                .build();

        GeminiLlmClient client = createClient(stubClient);

        StepVerifier.create(client.generate(new CvExtractionPrompt("system", "cv text")))
                .expectErrorMatches(throwable -> throwable instanceof ExtractionException ex
                        && "GEMINI_NETWORK_ERROR".equals(ex.getErrorCode())
                        && !ex.isRetryable())
                .verify();
    }

    private GeminiLlmClient createClient(WebClient webClient) {
        GeminiConfig geminiConfig = new GeminiConfig();
        ReflectionTestUtils.setField(geminiConfig, "apiKey", "test-key");
        ReflectionTestUtils.setField(geminiConfig, "baseUrl", "http://localhost");
        ReflectionTestUtils.setField(geminiConfig, "timeoutSeconds", 10);

        CircuitBreakerRegistry cbRegistry = CircuitBreakerRegistry.ofDefaults();
        RateLimiterRegistry rlRegistry = RateLimiterRegistry.ofDefaults();
        RetryRegistry retryRegistry = RetryRegistry.ofDefaults();

        return new GeminiLlmClient(
                webClient, geminiConfig, "gemini-test", 100,
                cbRegistry, rlRegistry, retryRegistry);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private GeminiLlmClient clientWithAlwaysFailingWebClient(AtomicInteger callCount, int maxAttempts) {
        // Intercept at the ExchangeFunction level — no actual HTTP, no running server.
        // 5xx response → WebClientResponseException → mapError() → retryable ExtractionException.
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
        ReflectionTestUtils.setField(geminiConfig, "apiKey",          "test-key");
        ReflectionTestUtils.setField(geminiConfig, "baseUrl",         "http://localhost");
        ReflectionTestUtils.setField(geminiConfig, "timeoutSeconds",  1); // fast — error fires before timeout anyway

        // Short wait-duration so the test finishes in milliseconds, not seconds.
        RetryConfig retryConfig = RetryConfig.custom()
                .maxAttempts(maxAttempts)
                .waitDuration(Duration.ofMillis(50))
                .build();

        // Permissive circuit breaker (default window=100) and rate limiter — must not cut retries short.
        CircuitBreakerRegistry cbRegistry = CircuitBreakerRegistry.ofDefaults();
        RateLimiterRegistry rlRegistry = RateLimiterRegistry.of(
                Map.of(INSTANCE_NAME, RateLimiterConfig.custom()
                        .limitForPeriod(1_000)
                        .limitRefreshPeriod(Duration.ofSeconds(1))
                        .timeoutDuration(Duration.ZERO)
                        .build()));

        return new GeminiLlmClient(
                stubClient, geminiConfig, "gemini-test", 100,
                cbRegistry, rlRegistry,
                RetryRegistry.of(Map.of(INSTANCE_NAME, retryConfig)));
    }
}
