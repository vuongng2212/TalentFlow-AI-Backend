package com.talent.cvparser.shared.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfig {

    public static final String CV_UPLOAD_QUEUE = "cv.upload.queue";
    public static final String CV_PARSED_QUEUE = "cv.parsed.queue";
    public static final String CV_DLQ          = "cv.upload.queue.dlq";
    public static final String CV_EXCHANGE     = "cv.exchange";
    public static final String DLQ_EXCHANGE    = "cv.dlq.exchange";

    @Bean
    public Queue cvUploadQueue() {
        return QueueBuilder.durable(CV_UPLOAD_QUEUE)
                .withArgument("x-dead-letter-exchange", DLQ_EXCHANGE)
                .withArgument("x-message-ttl", 3_600_000)
                .build();
    }

    @Bean
    public Queue cvParsedQueue() {
        return QueueBuilder.durable(CV_PARSED_QUEUE).build();
    }

    @Bean
    public Queue cvDeadLetterQueue() {
        return QueueBuilder.durable(CV_DLQ).build();
    }

    @Bean
    public DirectExchange cvExchange() {
        return new DirectExchange(CV_EXCHANGE);
    }

    @Bean
    public DirectExchange dlqExchange() {
        return new DirectExchange(DLQ_EXCHANGE);
    }

    @Bean
    public Binding cvUploadBinding(Queue cvUploadQueue, DirectExchange cvExchange) {
        return BindingBuilder.bind(cvUploadQueue)
                .to(cvExchange)
                .with(CV_UPLOAD_QUEUE);
    }

    @Bean
    public Binding dlqBinding(Queue cvDeadLetterQueue, DirectExchange dlqExchange) {
        return BindingBuilder.bind(cvDeadLetterQueue)
                .to(dlqExchange)
                .with(CV_UPLOAD_QUEUE);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}