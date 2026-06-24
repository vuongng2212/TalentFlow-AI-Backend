package com.talentflow.cvparser.listener;

import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvFailedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.shared.exception.*;
import com.talentflow.cvparser.usecase.CvParsingUseCase;
import com.rabbitmq.client.Channel;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;

@Slf4j
@Component
public class CvParserListener {

    private final CvParsingUseCase cvParsingUseCase;
    private final RabbitTemplate rabbitTemplate;
    // Offloading the pipeline frees the RabbitMQ listener thread to pick up the next
    // message immediately, decoupling listener concurrency from pipeline throughput.
    private final Executor parsingExecutor;
    private final int maxRetries;

    public CvParserListener(
            CvParsingUseCase cvParsingUseCase,
            RabbitTemplate rabbitTemplate,
            @Qualifier("parsingExecutor") Executor parsingExecutor,
            @Value("${llm.scoring.max-retries:3}") int maxRetries) {
        this.cvParsingUseCase = cvParsingUseCase;
        this.rabbitTemplate   = rabbitTemplate;
        this.parsingExecutor  = parsingExecutor;
        this.maxRetries       = maxRetries;
    }

    @RabbitListener(
            queues      = RabbitMqConfig.CV_PARSER_QUEUE,
            ackMode     = "MANUAL",
            concurrency = "${amqp.listener.concurrency:2}"
    )
    public void onCvUploaded(
            @Payload CvUploadedEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag,
            @Header(value = "x-retry-count", required = false) Integer retryCount) {

        // Set correlation ID from applicationId for structured logging
        MDC.put("correlationId", event.getApplicationId());

        log.info("[CVP-LISTENER] Received candidateId={}, fileKey={}, applicationId={}, retryCount={}",
                event.getCandidateId(), event.getFileKey(), event.getApplicationId(), retryCount);

        int currentRetry = retryCount != null ? retryCount : 0;

        CompletableFuture.runAsync(() -> runPipeline(event), parsingExecutor)
                .whenComplete((v, ex) -> {
                    try {
                        onPipelineComplete(event, channel, deliveryTag, currentRetry, ex);
                    } finally {
                        MDC.clear();
                    }
                });
    }

    private void runPipeline(CvUploadedEvent event) {
        try {
            cvParsingUseCase.execute(event);
        } catch (Throwable ex) {
            throw new CompletionException(ex);
        }
    }

    private void onPipelineComplete(CvUploadedEvent event, Channel channel, long deliveryTag, int currentRetry, Throwable ex) {
        if (ex == null) {
            ackMessage(channel, deliveryTag, event.getCandidateId());
        } else {
            Throwable cause = ex instanceof CompletionException ? ex.getCause() : ex;
            if (cause instanceof Error) {
                log.error("[CVP-LISTENER] Fatal JVM Error occurred during pipeline execution. candidateId={}, error={}",
                        event.getCandidateId(), cause.getMessage(), cause);
                return;
            }
            Exception pipelineEx = cause instanceof Exception e ? e : new RuntimeException(cause);

            boolean retryable = isExceptionRetryable(pipelineEx);

            log.error("[CVP-LISTENER] Pipeline failed. candidateId={}, retryable={}, reason={}",
                    event.getCandidateId(), retryable, pipelineEx.getMessage(), pipelineEx);

            if (retryable) {
                if (currentRetry < maxRetries) {
                    int nextRetry = currentRetry + 1;
                    log.warn("[CVP-LISTENER] Transient error, re-publishing for retry {}/{}. candidateId={}",
                            nextRetry, maxRetries, event.getCandidateId());
                    republishForRetry(event, nextRetry);
                    ackMessage(channel, deliveryTag, event.getCandidateId());
                } else {
                    log.error("[CVP-LISTENER] Max retries ({}) exhausted for transient error. Routing to DLQ. candidateId={}",
                            maxRetries, event.getCandidateId());
                    publishFailedEvent(event, pipelineEx, true);
                    nackMessage(channel, deliveryTag, event.getCandidateId(), false);
                }
            } else {
                publishFailedEvent(event, pipelineEx, false);
                nackMessage(channel, deliveryTag, event.getCandidateId(), false);
            }
        }
    }

    private void republishForRetry(CvUploadedEvent event, int nextRetry) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMqConfig.EXCHANGE_NAME,
                    RabbitMqConfig.ROUTING_KEY_CV_UPLOADED,
                    event,
                    message -> {
                        message.getMessageProperties().setHeader("x-retry-count", nextRetry);
                        return message;
                    }
            );
        } catch (Exception e) {
            log.error("[CVP-LISTENER] Failed to republish message for retry. candidateId={}",
                    event.getCandidateId(), e);
        }
    }

    private void ackMessage(Channel channel, long deliveryTag, String candidateId) {
        try {
            channel.basicAck(deliveryTag, false);
            log.info("[CVP-LISTENER] ACK sent. candidateId={}", candidateId);
        } catch (IOException ioEx) {
            log.error("[CVP-LISTENER] ACK failed. candidateId={}", candidateId, ioEx);
        }
    }

    private boolean isExceptionRetryable(Exception ex) {
        if (ex instanceof ScoringException se) return se.isRetryable();
        if (ex instanceof ExtractionException ee) return ee.isRetryable();
        if (ex instanceof ParsingException pe) return pe.isRetryable();
        if (ex instanceof StorageReadException) return true;
        if (ex instanceof StorageObjectNotFoundException) return false;
        if (ex instanceof PayloadTooLargeException) return false;
        if (ex instanceof UnsupportedDocumentFormatException) return false;
        // Default: assume non-retryable for unknown exceptions
        return false;
    }

    private void publishFailedEvent(CvUploadedEvent event, Exception ex, boolean retryable) {
        try {
            String errorCode = extractErrorCode(ex);
            CvFailedEvent failedEvent = CvFailedEvent.builder()
                    .candidateId(event.getCandidateId())
                    .applicationId(event.getApplicationId())
                    .jobId(event.getJobId())
                    .errorCode(errorCode)
                    .errorMessage(ex.getMessage() != null ? ex.getMessage() : "Unknown error")
                    .retryable(retryable)
                    .failedAt(Instant.now())
                    .build();
            rabbitTemplate.convertAndSend(RabbitMqConfig.ROUTING_KEY_CV_FAILED, failedEvent);
        } catch (Exception publishEx) {
            log.error("[CVP-LISTENER] Failed to publish CvFailedEvent. candidateId={}",
                    event.getCandidateId(), publishEx);
        }
    }

    private String extractErrorCode(Exception ex) {
        if (ex instanceof ScoringException se) return se.getErrorCode() != null ? se.getErrorCode() : "SCORING_FAILED";
        if (ex instanceof ExtractionException ee) return ee.getErrorCode() != null ? ee.getErrorCode() : "EXTRACTION_FAILED";
        if (ex instanceof ParsingException pe) return pe.getErrorCode() != null ? pe.getErrorCode() : "PARSING_FAILED";
        if (ex instanceof StorageReadException) return "STORAGE_READ_ERROR";
        if (ex instanceof StorageObjectNotFoundException) return "FILE_NOT_FOUND";
        if (ex instanceof PayloadTooLargeException) return "PAYLOAD_TOO_LARGE";
        if (ex instanceof UnsupportedDocumentFormatException) return "UNSUPPORTED_FORMAT";
        if (ex instanceof DocumentTooLongException) return "DOCUMENT_TOO_LONG";
        return "PARSING_FAILED";
    }

    private void nackMessage(Channel channel, long deliveryTag, String candidateId, boolean requeue) {
        try {
            channel.basicNack(deliveryTag, false, requeue);
            if (requeue) {
                log.warn("[CVP-LISTENER] NACK sent → requeue. candidateId={}", candidateId);
            } else {
                log.warn("[CVP-LISTENER] NACK sent → DLQ. candidateId={}", candidateId);
            }
        } catch (IOException ioEx) {
            log.error("[CVP-LISTENER] Failed to NACK message. candidateId={}", candidateId, ioEx);
        }
    }
}
