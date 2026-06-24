package com.talentflow.cvparser.shared.util;

import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;

import java.util.Map;

/**
 * Captures the current thread's MDC context before submitting a task and restores
 * it in the worker thread. Clears MDC after completion to prevent context leakage
 * to pooled thread reuse.
 *
 * <p>Wire into {@link java.util.concurrent.Executor} beans via
 * {@code ThreadPoolTaskExecutor#setTaskDecorator(new MdcTaskDecorator())}.
 */
public class MdcTaskDecorator implements TaskDecorator {

    @Override
    public Runnable decorate(Runnable runnable) {
        Map<String, String> contextMap = MDC.getCopyOfContextMap();
        return () -> {
            try {
                if (contextMap != null) {
                    MDC.setContextMap(contextMap);
                }
                runnable.run();
            } finally {
                MDC.clear();
            }
        };
    }
}
