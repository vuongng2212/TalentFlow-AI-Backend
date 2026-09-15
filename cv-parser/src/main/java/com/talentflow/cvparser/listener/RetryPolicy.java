package com.talentflow.cvparser.listener;

import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RetryPolicy {

    private final RabbitTemplate rabbitTemplate;

    @Getter
    private final int maxRetries;

    public RetryPolicy(
            RabbitTemplate rabbitTemplate,
            @Value("${cv.parser.max-retries:3}") int maxRetries) {
        this.rabbitTemplate = rabbitTemplate;
        this.maxRetries = maxRetries;
    }

    public int nextRetryCount(Integer currentRetry) {
        return (currentRetry != null ? currentRetry : 0) + 1;
    }

    public boolean shouldRetry(int currentRetry) {
        return currentRetry < maxRetries;
    }

    public void republishForRetry(CvUploadedEvent event, int nextRetry) {
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
            // Do NOT swallow — let caller handle NACK rather than ACKing an unqueued retry.
            throw new RuntimeException("Failed to republish message for retry", e);
        }
    }
}
