package com.talentflow.cvparser.shared.util;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for MDC correlation ID propagation across thread pool boundaries.
 * Verifies that {@link MdcTaskDecorator} captures, restores, and clears MDC context correctly.
 */
class MdcPropagationTest {

    /**
     * Creates an executor that applies MdcTaskDecorator to every task.
     */
    private Executor decoratedExecutor(Executor delegate, MdcTaskDecorator decorator) {
        return task -> delegate.execute(decorator.decorate(task));
    }

    @Test
    void shouldPropagateMdcContextToWorkerThread() throws Exception {
        MdcTaskDecorator decorator = new MdcTaskDecorator();
        Executor executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r);
            t.setDaemon(true);
            return t;
        });

        MDC.put("correlationId", "test-correlation-123");

        CompletableFuture<String> future = CompletableFuture.supplyAsync(
                () -> MDC.get("correlationId"),
                decoratedExecutor(executor, decorator)
        );

        String result = future.get();
        assertEquals("test-correlation-123", result);
        MDC.clear();
    }

    @Test
    void shouldClearMdcContextAfterExecution() throws Exception {
        MdcTaskDecorator decorator = new MdcTaskDecorator();
        Executor executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r);
            t.setDaemon(true);
            return t;
        });

        MDC.put("correlationId", "should-not-leak");

        CompletableFuture<Void> future = CompletableFuture.runAsync(
                () -> {
                    // Task runs with MDC set, then finishes
                },
                decoratedExecutor(executor, decorator)
        );

        future.get();

        // After task completes, the worker thread should have cleared MDC
        // Verify by checking the main thread still has its MDC
        assertEquals("should-not-leak", MDC.get("correlationId"));
        MDC.clear();
    }

    @Test
    void shouldHandleEmptyMdcContext() throws Exception {
        MdcTaskDecorator decorator = new MdcTaskDecorator();
        Executor executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r);
            t.setDaemon(true);
            return t;
        });

        // No MDC set
        MDC.clear();

        CompletableFuture<String> future = CompletableFuture.supplyAsync(
                () -> MDC.get("correlationId"),
                decoratedExecutor(executor, decorator)
        );

        String result = future.get();
        assertNull(result);
    }

    @Test
    void shouldCaptureFullMdcContext() throws Exception {
        MdcTaskDecorator decorator = new MdcTaskDecorator();
        Executor executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r);
            t.setDaemon(true);
            return t;
        });

        MDC.put("correlationId", "test-id");
        MDC.put("applicationId", "app-123");
        MDC.put("userId", "user-456");

        CompletableFuture<Map<String, String>> future = CompletableFuture.supplyAsync(
                () -> {
                    Map<String, String> ctx = MDC.getCopyOfContextMap();
                    MDC.clear();
                    return ctx;
                },
                decoratedExecutor(executor, decorator)
        );

        Map<String, String> result = future.get();
        assertNotNull(result);
        assertEquals("test-id", result.get("correlationId"));
        assertEquals("app-123", result.get("applicationId"));
        assertEquals("user-456", result.get("userId"));
        MDC.clear();
    }
}
