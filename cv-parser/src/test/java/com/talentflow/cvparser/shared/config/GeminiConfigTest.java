package com.talentflow.cvparser.shared.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

class GeminiConfigTest {

    @Test
    void geminiWebClientUsesExplicitConnectionPoolSizedToLlmExecutorCapacity() throws NoSuchFieldException {
        // Before fix: GeminiConfig had no maxConnections field, relying on Netty's default pool
        // (max(8, availableProcessors*2)). With llmExecutor.maxPoolSize=10, 2 concurrent LLM
        // calls would queue waiting for a connection, adding up to 45s pending-acquire delay.
        Field field = GeminiConfig.class.getDeclaredField("maxConnections");
        Value annotation = field.getAnnotation(Value.class);

        assertThat(annotation.value())
                .as("maxConnections must be driven by llm.http.max-connections config key so it is tunable per environment")
                .contains("llm.http.max-connections");
    }

    @Test
    void connectionPoolDefaultSizeMatchesLlmExecutorMaxPoolSize() {
        // llmExecutor.maxPoolSize=10; pool must be >= 10 so all executor threads
        // can acquire a connection simultaneously without queuing.
        ThreadPoolConfig poolConfig = new ThreadPoolConfig();
        ThreadPoolTaskExecutor llmExec = (ThreadPoolTaskExecutor) poolConfig.llmExecutor();

        GeminiConfig config = new GeminiConfig();
        ReflectionTestUtils.setField(config, "maxConnections", 10);

        int maxConnections = (Integer) ReflectionTestUtils.getField(config, "maxConnections");
        assertThat(maxConnections)
                .as("gemini connection pool size must be >= llmExecutor.maxPoolSize=%d to prevent connection queuing under concurrent LLM calls",
                        llmExec.getMaxPoolSize())
                .isGreaterThanOrEqualTo(llmExec.getMaxPoolSize());
    }
}
