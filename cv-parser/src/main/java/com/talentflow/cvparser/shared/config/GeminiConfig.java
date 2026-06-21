package com.talentflow.cvparser.shared.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

import java.time.Duration;

/**
 * Google Gemini LLM client configuration.
 *
 * Uses environment variables:
 *   - GEMINI_API_KEY: API key for authentication
 *   - LLM_MODEL: Model name (default: gemini-2.5-flash)
 *   - LLM_TIMEOUT_SECONDS: Request timeout
 *   - LLM_HTTP_MAX_CONNECTIONS: HTTP connection pool size (should match llmExecutor.maxPoolSize)
 */
@Configuration
public class GeminiConfig {

    @Value("${llm.api-key:}")
    private String apiKey;

    @Value("${llm.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String baseUrl;

    @Value("${llm.model:gemini-2.5-flash}")
    private String model;

    @Value("${llm.timeout-seconds:8}")
    private int timeoutSeconds;

    // Must be >= llmExecutor.maxPoolSize (10) to prevent connection queuing when all
    // executor threads issue concurrent Gemini requests.
    @Value("${llm.http.max-connections:10}")
    private int maxConnections;

    /**
     * WebClient configured for Gemini API calls with an explicit connection pool.
     * Default Netty pool caps at max(8, availableProcessors*2); with llmExecutor
     * maxPoolSize=10, 2 threads would queue and hit 45s pending-acquire timeout.
     */
    @Bean
    public WebClient geminiWebClient() {
        HttpClient httpClient = HttpClient.create(
                        ConnectionProvider.builder("gemini-pool")
                                .maxConnections(maxConnections)
                                .pendingAcquireTimeout(Duration.ofSeconds(5))
                                .maxIdleTime(Duration.ofSeconds(30))
                                .build())
                .responseTimeout(Duration.ofSeconds(timeoutSeconds));

        return WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
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
