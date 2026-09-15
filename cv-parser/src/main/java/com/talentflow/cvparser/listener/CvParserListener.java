package com.talentflow.cvparser.listener;

import com.rabbitmq.client.Channel;
import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvFailedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.shared.util.PiiRedactor;
import com.talentflow.cvparser.usecase.CvParsingUseCase;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;

@Slf4j
@Component
public class CvParserListener {

    private final CvParsingUseCase cvParsingUseCase;
    private final RabbitTemplate rabbitTemplate;
    private final Executor parsingExecutor;
    private final RetryPolicy retryPolicy;
    private final FailureClassifier failureClassifier;

    @Autowired
    public CvParserListener(
            CvParsingUseCase cvParsingUseCase,
            RabbitTemplate rabbitTemplate,
            @Qualifier("parsingExecutor") Executor parsingExecutor,
            RetryPolicy retryPolicy,
            FailureClassifier failureClassifier) {
        this.cvParsingUseCase = cvParsingUseCase;
        this.rabbitTemplate = rabbitTemplate;
        this.parsingExecutor = parsingExecutor;
        this.retryPolicy = retryPolicy;
        this.failureClassifier = failureClassifier;
    }

    public CvParserListener(
            CvParsingUseCase cvParsingUseCase,
            RabbitTemplate rabbitTemplate,
            Executor parsingExecutor,
            int maxRetries,
            PiiRedactor piiRedactor) {
        this(
                cvParsingUseCase,
                rabbitTemplate,
                parsingExecutor,
                new RetryPolicy(rabbitTemplate, maxRetries),
                new FailureClassifier(piiRedactor)
        );
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

    public void runPipeline(CvUploadedEvent event) {
        try {
            cvParsingUseCase.execute(event);
        } catch (Throwable ex) {
            throw new CompletionException(ex);
        }
    }

    public void onPipelineComplete(CvUploadedEvent event, Channel channel, long deliveryTag, int currentRetry, Throwable ex) {
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

            boolean retryable = failureClassifier.isRetryable(pipelineEx);

            log.error("[CVP-LISTENER] Pipeline failed. candidateId={}, retryable={}, reason={}",
                    event.getCandidateId(), retryable, pipelineEx.getMessage(), pipelineEx);

            if (retryable) {
                if (retryPolicy.shouldRetry(currentRetry)) {
                    int nextRetry = retryPolicy.nextRetryCount(currentRetry);
                    log.warn("[CVP-LISTENER] Transient error, re-publishing for retry {}/{}. candidateId={}",
                            nextRetry, retryPolicy.getMaxRetries(), event.getCandidateId());
                    try {
                        retryPolicy.republishForRetry(event, nextRetry);
                        // Only ACK the original after the retry copy is safely on the queue.
                        ackMessage(channel, deliveryTag, event.getCandidateId());
                    } catch (Exception republishEx) {
                        log.error("[CVP-LISTENER] Failed to republish message for retry, sending NACK. candidateId={}",
                                event.getCandidateId(), republishEx);
                        publishFailedEvent(event, pipelineEx, true);
                        nackMessage(channel, deliveryTag, event.getCandidateId(), false);
                    }
                } else {
                    log.error("[CVP-LISTENER] Max retries ({}) exhausted for transient error. Routing to DLQ. candidateId={}",
                            retryPolicy.getMaxRetries(), event.getCandidateId());
                    publishFailedEvent(event, pipelineEx, true);
                    nackMessage(channel, deliveryTag, event.getCandidateId(), false);
                }
            } else {
                publishFailedEvent(event, pipelineEx, false);
                nackMessage(channel, deliveryTag, event.getCandidateId(), false);
            }
        }
    }

    private void publishFailedEvent(CvUploadedEvent event, Exception ex, boolean retryable) {
        try {
            CvFailedEvent failedEvent = failureClassifier.classify(event, ex, retryable);
            rabbitTemplate.convertAndSend(RabbitMqConfig.ROUTING_KEY_CV_FAILED, failedEvent);
        } catch (Exception publishEx) {
            log.error("[CVP-LISTENER] Failed to publish CvFailedEvent. candidateId={}",
                    event.getCandidateId(), publishEx);
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
