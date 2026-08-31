package com.talentflow.cvparser.listener;

import com.rabbitmq.client.Channel;
import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvFailedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.shared.exception.*;
import com.talentflow.cvparser.shared.util.PiiRedactor;
import com.talentflow.cvparser.usecase.CvParsingUseCase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.Instant;
import java.util.concurrent.CompletionException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Tests for exception handling in {@link CvParserListener}.
 * Covers retryable vs non-retryable classification and DLQ routing.
 */
@ExtendWith(MockitoExtension.class)
class CvParserListenerExceptionTest {

    @Mock
    private CvParsingUseCase cvParsingUseCase;
    @Mock
    private RabbitTemplate rabbitTemplate;
    @Mock
    private Channel channel;

    @Captor
    private ArgumentCaptor<CvFailedEvent> failedEventCaptor;

    private CvParserListener listener;
    private CvUploadedEvent event;

    @BeforeEach
    void setUp() {
        listener = new CvParserListener(cvParsingUseCase, rabbitTemplate, Runnable::run, 3, new PiiRedactor());
        event = CvUploadedEvent.builder()
                .candidateId("3fa85f64-5717-4562-b3fc-2c963f66afa6")
                .applicationId("3fa85f64-5717-4562-b3fc-2c963f66afa7")
                .jobId("3fa85f64-5717-4562-b3fc-2c963f66afa8")
                .bucket("talentflow-cvs")
                .fileKey("test.pdf")
                .mimeType("application/pdf")
                .uploadedAt(Instant.now())
                .build();
    }

    @Test
    void shouldAssertNackToDlqOnNonRetryableFailureAndRepublishWithIncrementedRetryCountOnRetryableFailure() throws Exception {
        // 1. Non-retryable failure -> NACK to DLQ (requeue=false)
        doThrow(new UnsupportedDocumentFormatException("Invalid file type"))
                .when(cvParsingUseCase).execute(event);

        listener.onCvUploaded(event, channel, 10L, 0);

        verify(channel).basicNack(10L, false, false);
        verify(rabbitTemplate).convertAndSend(eq(RabbitMqConfig.ROUTING_KEY_CV_FAILED), any(CvFailedEvent.class));
        verify(rabbitTemplate, never()).convertAndSend(eq(RabbitMqConfig.EXCHANGE_NAME), eq(RabbitMqConfig.ROUTING_KEY_CV_UPLOADED), eq(event), any(MessagePostProcessor.class));

        reset(channel, rabbitTemplate, cvParsingUseCase);

        // 2. Retryable failure -> Republish with incremented retry count (from 1 to 2) and ACK original
        doThrow(new StorageReadException("S3 connection reset", new java.io.IOException("reset")))
                .when(cvParsingUseCase).execute(event);

        ArgumentCaptor<MessagePostProcessor> postProcessorCaptor = ArgumentCaptor.forClass(MessagePostProcessor.class);

        listener.onCvUploaded(event, channel, 20L, 1);

        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMqConfig.EXCHANGE_NAME),
                eq(RabbitMqConfig.ROUTING_KEY_CV_UPLOADED),
                eq(event),
                postProcessorCaptor.capture()
        );

        Message message = new Message(new byte[0], new MessageProperties());
        Message processedMessage = postProcessorCaptor.getValue().postProcessMessage(message);
        assertThat((Integer) processedMessage.getMessageProperties().getHeader("x-retry-count")).isEqualTo(2);

        verify(channel).basicAck(20L, false);
        verify(channel, never()).basicNack(anyLong(), anyBoolean(), anyBoolean());
        verify(rabbitTemplate, never()).convertAndSend(eq(RabbitMqConfig.ROUTING_KEY_CV_FAILED), any(CvFailedEvent.class));
    }

    @Test
    void shouldPublishFailedEventWithRetryableFalseOnNonRetryableException() throws Exception {
        doThrow(new UnsupportedDocumentFormatException("Unsupported format"))
                .when(cvParsingUseCase).execute(event);

        listener.onCvUploaded(event, channel, 1L, 0);

        verify(rabbitTemplate).convertAndSend(eq("cv.failed"), failedEventCaptor.capture());
        CvFailedEvent failedEvent = failedEventCaptor.getValue();
        assertFalse(failedEvent.getRetryable());
        assertNotNull(failedEvent.getFailedAt());
        assertEquals("UNSUPPORTED_FORMAT", failedEvent.getErrorCode());
    }

    @Test
    void shouldRepublishMessageOnRetryableExceptionWhenUnderMaxRetries() throws Exception {
        doThrow(new StorageReadException("S3 timeout", new java.io.IOException("timeout")))
                .when(cvParsingUseCase).execute(event);

        listener.onCvUploaded(event, channel, 1L, 0);

        // Verify that failed event was NOT published yet
        verify(rabbitTemplate, never()).convertAndSend(eq("cv.failed"), any(CvFailedEvent.class));

        // Verify that message was republished with incremented retry count (1)
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMqConfig.EXCHANGE_NAME),
                eq(RabbitMqConfig.ROUTING_KEY_CV_UPLOADED),
                eq(event),
                any(MessagePostProcessor.class)
        );

        // Verify old message was ACKed
        verify(channel).basicAck(1L, false);
    }

    @Test
    void shouldPublishFailedEventWithRetryableTrueOnRetryableExceptionWhenMaxRetriesExhausted() throws Exception {
        doThrow(new StorageReadException("S3 timeout", new java.io.IOException("timeout")))
                .when(cvParsingUseCase).execute(event);

        // Call with retryCount = 3 (maxRetries is 3)
        listener.onCvUploaded(event, channel, 1L, 3);

        // Verify failed event published
        verify(rabbitTemplate).convertAndSend(eq("cv.failed"), failedEventCaptor.capture());
        CvFailedEvent failedEvent = failedEventCaptor.getValue();
        assertTrue(failedEvent.getRetryable());
        assertNotNull(failedEvent.getFailedAt());

        // Verify message was NACKed to DLQ (requeue = false)
        verify(channel).basicNack(1L, false, false);
    }

    @Test
    void shouldNackToDlqOnNonRetryableException() throws Exception {
        doThrow(new PayloadTooLargeException("File too large"))
                .when(cvParsingUseCase).execute(event);

        listener.onCvUploaded(event, channel, 1L, 0);

        verify(channel).basicNack(1L, false, false);
    }

    @Test
    void shouldHandleCompletionExceptionWrapping() throws Exception {
        doThrow(new CompletionException(new StorageObjectNotFoundException("File not found")))
                .when(cvParsingUseCase).execute(event);

        listener.onCvUploaded(event, channel, 1L, 0);

        verify(rabbitTemplate).convertAndSend(eq("cv.failed"), failedEventCaptor.capture());
        CvFailedEvent failedEvent = failedEventCaptor.getValue();
        assertFalse(failedEvent.getRetryable());
    }

    @Test
    void shouldIncludeErrorCodeInFailedEvent() throws Exception {
        doThrow(new ExtractionException("Gemini error", "GEMINI_NETWORK_ERROR", true))
                .when(cvParsingUseCase).execute(event);

        // Exhaust retries to trigger event publish
        listener.onCvUploaded(event, channel, 1L, 3);

        verify(rabbitTemplate).convertAndSend(eq("cv.failed"), failedEventCaptor.capture());
        CvFailedEvent failedEvent = failedEventCaptor.getValue();
        assertEquals("GEMINI_NETWORK_ERROR", failedEvent.getErrorCode());
        assertTrue(failedEvent.getRetryable());
    }
}
