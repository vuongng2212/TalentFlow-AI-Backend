package com.talentflow.cvparser.shared.config;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

import static org.assertj.core.api.Assertions.assertThat;

class ThreadPoolConfigTest {

    private static final int DEFAULT_MAX_PARALLEL_PAGES = 2; // app.ocr.max-parallel-pages default

    @Test
    void ocrPageExecutorHasEnoughThreadsForAllConcurrentExtractCallsWithAllPagesInFlight() {
        // B1's two-phase design submits ALL pages from one extractText() call concurrently.
        // If ocrExecutor has N concurrent threads and each submits maxParallelPages tasks,
        // ocrPageExecutor must have at least N × maxParallelPages threads so tasks from
        // different extractText() calls are not serialised in the queue.
        // With only corePoolSize=2 threads: tasks 3-N×maxParallelPages queue up, and the pages
        // from one call must wait for another call's pages to finish — defeating B1.
        ThreadPoolConfig config = new ThreadPoolConfig();

        ThreadPoolTaskExecutor ocrExec  = (ThreadPoolTaskExecutor) config.ocrExecutor();
        ThreadPoolTaskExecutor pageExec = (ThreadPoolTaskExecutor) config.ocrPageExecutor();

        int requiredPageThreads = ocrExec.getMaxPoolSize() * DEFAULT_MAX_PARALLEL_PAGES;

        assertThat(pageExec.getMaxPoolSize())
                .as("ocrPageExecutor.maxPoolSize must be >= ocrExecutor.maxPoolSize(%d) × maxParallelPages(%d) = %d " +
                    "so concurrent extractText() calls can have their pages in-flight simultaneously",
                    ocrExec.getMaxPoolSize(), DEFAULT_MAX_PARALLEL_PAGES, requiredPageThreads)
                .isGreaterThanOrEqualTo(requiredPageThreads);
    }
}
