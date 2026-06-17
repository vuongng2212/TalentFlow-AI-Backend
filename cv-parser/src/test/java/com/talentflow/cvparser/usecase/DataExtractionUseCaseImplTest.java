package com.talentflow.cvparser.usecase;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

class DataExtractionUseCaseImplTest {

    @Test
    void outerExtractionTimeoutUsesDecoupledConfigKeyToAllowRetries() throws NoSuchFieldException {
        // When the outer .get(timeout) guard reads the same key as the per-call WebClient timeout
        // (llm.timeout-seconds=8), both fire simultaneously on the first call failure —
        // the Resilience4j retry (max-attempts=2) never executes, wasting the retry budget.
        // Fix: outer guard reads llm.extraction-timeout-seconds, sized to cover the full retry
        // budget: maxAttempts × (perCallTimeout + waitDuration) = 2 × (8 + 2) = 20s.
        Field field = DataExtractionUseCaseImpl.class.getDeclaredField("timeoutSeconds");
        Value annotation = field.getAnnotation(Value.class);

        assertThat(annotation.value())
                .as("DataExtractionUseCaseImpl outer timeout must read llm.extraction-timeout-seconds, " +
                    "not llm.timeout-seconds — same key causes the outer guard to fire simultaneously " +
                    "with the per-call WebClient timeout, preventing retries from executing")
                .contains("llm.extraction-timeout-seconds")
                .doesNotContain("llm.timeout-seconds");
    }
}
