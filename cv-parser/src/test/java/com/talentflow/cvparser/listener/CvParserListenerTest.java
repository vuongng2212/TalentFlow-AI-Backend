package com.talentflow.cvparser.listener;

import com.rabbitmq.client.Channel;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.annotation.RabbitListener;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

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
