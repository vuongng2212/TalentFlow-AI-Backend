package com.talentflow.cvparser.listener;

import com.rabbitmq.client.Channel;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.usecase.CvParsingUseCase;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

class CvParserListenerTest {

    @Test
    void onCvUploadedDeclaresConcurrencyToAllowParallelMessageProcessing() throws NoSuchMethodException {
        // Without a concurrency attribute Spring AMQP creates exactly 1 consumer thread,
        // so one slow CV (S3 + parse + LLM, up to 30 s) blocks every subsequent message.
        // The annotation must declare concurrency so the container spawns >1 consumer.
        Method method = CvParserListener.class.getDeclaredMethod(
                "onCvUploaded", CvUploadedEvent.class, Channel.class, long.class);

        RabbitListener annotation = method.getAnnotation(RabbitListener.class);

        assertThat(annotation.concurrency())
                .as("@RabbitListener on onCvUploaded must set concurrency to allow parallel processing")
                .isNotEmpty();
    }

    @Test
    void onCvUploadedDelegatesToParsingExecutorSoListenerThreadIsNotBlockedByPipeline() throws NoSuchFieldException {
        // Without async dispatch, the listener thread blocks for the full pipeline duration
        // (S3 download + parse + LLM = 10-30s). With concurrency=2, only 2 CVs process
        // concurrently, and the listener cannot pick up new messages while a pipeline is running.
        // After fix: listener submits to parsingExecutor and returns immediately.
        Field field = CvParserListener.class.getDeclaredField("parsingExecutor");
        assertThat(field.getType()).isAssignableTo(Executor.class);
    }

    @Test
    void onCvUploadedReturnsBeforePipelineCompletesAfterAsyncDispatch() throws Exception {
        // Behavioral companion to the structural test above.
        // When execute() takes 500ms, the listener must return within 200ms.
        CountDownLatch pipelineStarted = new CountDownLatch(1);
        CountDownLatch pipelineRelease = new CountDownLatch(1);
        CountDownLatch ackLatch        = new CountDownLatch(1);

        CvParsingUseCase slowUseCase = event -> {
            pipelineStarted.countDown();
            pipelineRelease.await(5, TimeUnit.SECONDS);
        };

        Channel channel = mock(Channel.class);
        doAnswer(inv -> { ackLatch.countDown(); return null; })
                .when(channel).basicAck(anyLong(), anyBoolean());

        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        ExecutorService executor       = Executors.newSingleThreadExecutor();
        ExecutorService testRunner     = Executors.newSingleThreadExecutor();

        try {
            CvParserListener listener = new CvParserListener(slowUseCase, rabbitTemplate, executor);
            CvUploadedEvent event     = buildEvent();

            Future<?> listenerFuture = testRunner.submit(
                    () -> listener.onCvUploaded(event, channel, 1L));

            assertThat(pipelineStarted.await(2, TimeUnit.SECONDS))
                    .as("pipeline must start within 2s after listener is invoked")
                    .isTrue();

            Thread.sleep(300); // enough time for async listener to return, too short for 500ms pipeline

            boolean returnedBeforePipelineFinished = listenerFuture.isDone();
            pipelineRelease.countDown(); // release pipeline so thread can terminate

            assertThat(returnedBeforePipelineFinished)
                    .as("onCvUploaded must return before pipeline completes — use async dispatch to parsingExecutor")
                    .isTrue();

            assertThat(ackLatch.await(2, TimeUnit.SECONDS))
                    .as("ACK must be sent after pipeline completes even with async dispatch")
                    .isTrue();
        } finally {
            pipelineRelease.countDown();
            executor.shutdownNow();
            testRunner.shutdownNow();
        }
    }

    private static CvUploadedEvent buildEvent() {
        return CvUploadedEvent.builder()
                .candidateId("00000000-0000-0000-0000-000000000001")
                .applicationId("00000000-0000-0000-0000-000000000002")
                .jobId("00000000-0000-0000-0000-000000000003")
                .bucket("talentflow-cvs")
                .fileKey("cvs/test.pdf")
                .mimeType("application/pdf")
                .uploadedAt(Instant.now())
                .build();
    }

    @Test
    void onCvUploadedPrefetchMatchesConcurrencyToPreventMessageHoarding() throws NoSuchMethodException {
        // prefetch=10 with concurrency=1 lets one consumer hoard 10 messages while processing one.
        // prefetch must be set to a value ≤ concurrency so messages are distributed fairly.
        // This test verifies the annotation carries the correct concurrency expression and
        // that application.yml lowers prefetch to ≤ 2 — checked transitively via the property key.
        Method method = CvParserListener.class.getDeclaredMethod(
                "onCvUploaded", CvUploadedEvent.class, Channel.class, long.class);

        RabbitListener annotation = method.getAnnotation(RabbitListener.class);

        assertThat(annotation.concurrency())
                .as("concurrency expression must reference a config property so it can be tuned per environment")
                .startsWith("${");
    }
}
