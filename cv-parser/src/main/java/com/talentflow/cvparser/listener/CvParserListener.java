package com.talentflow.cvparser.listener;

import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvFailedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.usecase.CvParsingUseCase;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class CvParserListener {

    private final CvParsingUseCase cvParsingUseCase;
    private final RabbitTemplate rabbitTemplate;

    @RabbitListener(
            queues  = RabbitMqConfig.CV_PARSER_QUEUE,
            ackMode = "MANUAL"
    )
    public void onCvUploaded(
            @Payload CvUploadedEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {

        log.info("[CVP-LISTENER] Received candidateId={}, fileKey={}, applicationId={}",
                event.getCandidateId(), event.getFileKey(), event.getApplicationId());

        try {
            cvParsingUseCase.execute(event);

            channel.basicAck(deliveryTag, false);
            log.info("[CVP-LISTENER] ACK sent. candidateId={}", event.getCandidateId());

        } catch (Exception ex) {
            log.error("[CVP-LISTENER] Pipeline failed. candidateId={}, reason={}",
                    event.getCandidateId(), ex.getMessage(), ex);

            publishFailedEvent(event, ex);
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
