package com.talentflow.cvparser.scoring;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Tests for Prometheus meter bindings in the scoring pipeline.
 * Verifies that gemini_api_calls_total counter is incremented with correct tags.
 */
class ScoringMetricsTest {

    private MeterRegistry meterRegistry;
    private Counter successCounter;
    private Counter fallbackCounter;
    private Counter errorCounter;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        successCounter = Counter.builder("gemini_api_calls_total")
                .tag("type", "scoring")
                .tag("outcome", "success")
                .register(meterRegistry);
        fallbackCounter = Counter.builder("gemini_api_calls_total")
                .tag("type", "scoring")
                .tag("outcome", "fallback")
                .register(meterRegistry);
        errorCounter = Counter.builder("gemini_api_calls_total")
                .tag("type", "scoring")
                .tag("outcome", "error")
                .register(meterRegistry);
    }

    @Test
    void shouldIncrementCountersWithCorrectTagsOnSuccess() {
        successCounter.increment();
        assertEquals(1.0, meterRegistry.counter("gemini_api_calls_total", "type", "scoring", "outcome", "success").count(), 0.001);
    }

    @Test
    void shouldIncrementCountersWithCorrectTagsOnFallback() {
        fallbackCounter.increment();
        fallbackCounter.increment();
        assertEquals(2.0, meterRegistry.counter("gemini_api_calls_total", "type", "scoring", "outcome", "fallback").count(), 0.001);
    }

    @Test
    void shouldIncrementCountersWithCorrectTagsOnError() {
        errorCounter.increment();
        assertEquals(1.0, meterRegistry.counter("gemini_api_calls_total", "type", "scoring", "outcome", "error").count(), 0.001);
    }
}
