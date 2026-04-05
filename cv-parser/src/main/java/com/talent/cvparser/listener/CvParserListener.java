package com.talent.cvparser.listener;

import com.talent.cvparser.shared.config.RabbitMqConfig;
import com.talent.cvparser.usecase.CvParsingUseCase;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class CvParserListener {


    private final CvParsingUseCase cvParsingUseCase;

    @RabbitListener(
            queues   = RabbitMqConfig.CV_UPLOAD_QUEUE,
            ackMode  = "MANUAL"
    )
    public void onCvUploaded(
            @Payload CvUploadEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {

        log.info("[CVP-LISTENER] Received cvId={}, objectKey={}, applicantId={}",
                event.getCvId(), event.getObjectKey(), event.getApplicantId());

        try {
            cvParsingUseCase.execute(event);

            channel.basicAck(deliveryTag, false);
            log.info("[CVP-LISTENER] ACK sent. cvId={}", event.getCvId());

        } catch (Exception ex) {
            log.error("[CVP-LISTENER] Pipeline failed. cvId={}, reason={}",
                    event.getCvId(), ex.getMessage(), ex);
            nackToDlq(channel, deliveryTag, event.getCvId());
        }
    }

    private void nackToDlq(Channel channel, long deliveryTag, String cvId) {
        try {
            channel.basicNack(deliveryTag, false, false);
            log.warn("[CVP-LISTENER] NACK sent → DLQ. cvId={}", cvId);
        } catch (IOException ioEx) {
            log.error("[CVP-LISTENER] Failed to NACK message. cvId={}", cvId, ioEx);
        }
    }
}