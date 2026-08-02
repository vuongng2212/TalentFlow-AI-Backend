package com.talentflow.cvparser.listener;

import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvFailedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.usecase.CvParsingUseCase;
import com.rabbitmq.client.Channel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.beans.factory.annotation.Qualifier;
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

    public CvParserListener(
            CvParsingUseCase cvParsingUseCase,
            RabbitTemplate rabbitTemplate,
            @Qualifier("parsingExecutor") Executor parsingExecutor) {
        this.cvParsingUseCase = cvParsingUseCase;
        this.rabbitTemplate   = rabbitTemplate;
        this.parsingExecutor  = parsingExecutor;
    }

    @RabbitListener(
            queues      = RabbitMqConfig.CV_PARSER_QUEUE,
            ackMode     = "MANUAL",
            concurrency = "${amqp.listener.concurrency:2}"
    )
    public void onCvUploaded(
            @Payload CvUploadedEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {

        log.info("[CVP-LISTENER] Received candidateId={}, fileKey={}, applicationId={}",
                event.getCandidateId(), event.getFileKey(), event.getApplicationId());

        CompletableFuture.runAsync(() -> runPipeline(event), parsingExecutor)
                .whenComplete((v, ex) -> onPipelineComplete(event, channel, deliveryTag, ex));
    }

    private void runPipeline(CvUploadedEvent event) {
        try {
            cvParsingUseCase.execute(event);
        } catch (Throwable ex) {
            throw new CompletionException(ex);
        }
    }

    private void onPipelineComplete(CvUploadedEvent event, Channel channel, long deliveryTag, Throwable ex) {
        if (ex == null) {
            try {
                channel.basicAck(deliveryTag, false);
                log.info("[CVP-LISTENER] ACK sent. candidateId={}", event.getCandidateId());
            } catch (IOException ioEx) {
                log.error("[CVP-LISTENER] ACK failed. candidateId={}", event.getCandidateId(), ioEx);
            }
        } else {
            Throwable cause = ex instanceof CompletionException ? ex.getCause() : ex;
            if (cause instanceof Error) {
                log.error("[CVP-LISTENER] Fatal JVM Error occurred during pipeline execution. candidateId={}, error={}",
                        event.getCandidateId(), cause.getMessage(), cause);
                return;
            }
            Exception pipelineEx = cause instanceof Exception e ? e : new RuntimeException(cause);
            log.error("[CVP-LISTENER] Pipeline failed. candidateId={}, reason={}",
                    event.getCandidateId(), pipelineEx.getMessage(), pipelineEx);
            publishFailedEvent(event, pipelineEx);
            nackToDlq(channel, deliveryTag, event.getCandidateId());
        }
    }

    private void publishFailedEvent(CvUploadedEvent event, Exception ex) {
        try {
            CvFailedEvent failedEvent = CvFailedEvent.builder()
                    .candidateId(event.getCandidateId())
                    .applicationId(event.getApplicationId())
                    .jobId(event.getJobId())
                    .errorCode("PARSING_FAILED")
                    .errorMessage(ex.getMessage() != null ? ex.getMessage() : "Unknown error")
                    .retryable(false)
                    .failedAt(Instant.now())
                    .build();
            rabbitTemplate.convertAndSend(RabbitMqConfig.ROUTING_KEY_CV_FAILED, failedEvent);
        } catch (Exception publishEx) {
            log.error("[CVP-LISTENER] Failed to publish CvFailedEvent. candidateId={}",
                    event.getCandidateId(), publishEx);
        }
    }

    private void nackToDlq(Channel channel, long deliveryTag, String candidateId) {
        try {
            channel.basicNack(deliveryTag, false, false);
            log.warn("[CVP-LISTENER] NACK sent → DLQ. candidateId={}", candidateId);
        } catch (IOException ioEx) {
            log.error("[CVP-LISTENER] Failed to NACK message. candidateId={}", candidateId, ioEx);
        }
    }
}
