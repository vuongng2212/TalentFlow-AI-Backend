package com.talentflow.cvparser.listener;

import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class RetryPolicyTest {

    private RabbitTemplate rabbitTemplate;
    private RetryPolicy retryPolicy;

    @BeforeEach
    void setUp() {
        rabbitTemplate = mock(RabbitTemplate.class);
        retryPolicy = new RetryPolicy(rabbitTemplate, 3);
    }

    @Test
    void shouldCalculateNextRetryCountCorrectly() {
        assertThat(retryPolicy.nextRetryCount(null)).isEqualTo(1);
        assertThat(retryPolicy.nextRetryCount(0)).isEqualTo(1);
        assertThat(retryPolicy.nextRetryCount(1)).isEqualTo(2);
        assertThat(retryPolicy.nextRetryCount(2)).isEqualTo(3);
    }

    @Test
    void shouldCheckRetryEligibilityAgainstMaxRetries() {
        assertThat(retryPolicy.shouldRetry(0)).isTrue();
        assertThat(retryPolicy.shouldRetry(1)).isTrue();
        assertThat(retryPolicy.shouldRetry(2)).isTrue();
        assertThat(retryPolicy.shouldRetry(3)).isFalse();
        assertThat(retryPolicy.shouldRetry(4)).isFalse();
    }

    @Test
    void shouldRepublishForRetryWithHeader() {
        CvUploadedEvent event = CvUploadedEvent.builder()
                .candidateId("3fa85f64-5717-4562-b3fc-2c963f66afa6")
                .applicationId("3fa85f64-5717-4562-b3fc-2c963f66afa7")
                .jobId("3fa85f64-5717-4562-b3fc-2c963f66afa8")
                .bucket("talentflow-cvs")
                .fileKey("test.pdf")
                .mimeType("application/pdf")
                .uploadedAt(Instant.now())
                .build();

        ArgumentCaptor<MessagePostProcessor> postProcessorCaptor = ArgumentCaptor.forClass(MessagePostProcessor.class);

        retryPolicy.republishForRetry(event, 2);

        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMqConfig.EXCHANGE_NAME),
                eq(RabbitMqConfig.ROUTING_KEY_CV_UPLOADED),
                eq(event),
                postProcessorCaptor.capture()
        );

        Message message = new Message(new byte[0], new MessageProperties());
        Message processedMessage = postProcessorCaptor.getValue().postProcessMessage(message);
        assertThat((Integer) processedMessage.getMessageProperties().getHeader("x-retry-count")).isEqualTo(2);
    }

    @Test
    void shouldWrapExceptionWhenRepublishFails() {
        CvUploadedEvent event = CvUploadedEvent.builder().build();
        doThrow(new RuntimeException("RabbitMQ connection error"))
                .when(rabbitTemplate).convertAndSend(anyString(), anyString(), any(Object.class), any(MessagePostProcessor.class));

        assertThatThrownBy(() -> retryPolicy.republishForRetry(event, 1))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Failed to republish message for retry");
    }
}
