package com.talentflow.cvparser.shared.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ configuration following ADR-009 polyglot messaging topology.
 *
 * Exchange: talentflow.events (topic, durable)
 * Queues:
 *   - cv_parser.jobs (main queue, bound to cv.uploaded routing key)
 *   - cv_parser.jobs.dlq (dead letter queue)
 *
 * @see docs/adr/ADR-009-rabbitmq-polyglot.md
 */
@Configuration
public class RabbitMqConfig {

    // Exchange name (shared across all services)
    public static final String EXCHANGE_NAME = "talentflow.events";

    // Queue names
    public static final String CV_PARSER_QUEUE = "cv_parser.jobs";
    public static final String CV_PARSER_DLQ = "cv_parser.jobs.dlq";

    // Routing keys
    public static final String ROUTING_KEY_CV_UPLOADED = "cv.uploaded";
    public static final String ROUTING_KEY_CV_PARSED = "cv.parsed";
    public static final String ROUTING_KEY_CV_FAILED = "cv.failed";

    // Message TTL (24 hours in milliseconds)
    private static final int MESSAGE_TTL = 86400000;

    /**
     * Topic exchange for all TalentFlow events.
     * Shared by API Gateway, CV Parser, and Notification services.
     */
    @Bean
    public TopicExchange talentflowEventsExchange() {
        return ExchangeBuilder
                .topicExchange(EXCHANGE_NAME)
                .durable(true)
                .build();
    }

    /**
     * Main CV parser queue with dead letter configuration.
     * Messages failing after retries are routed to DLQ.
     */
    @Bean
    public Queue cvParserQueue() {
        return QueueBuilder
                .durable(CV_PARSER_QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", CV_PARSER_DLQ)
                .withArgument("x-message-ttl", MESSAGE_TTL)
                .build();
    }

    /**
     * Dead letter queue for failed CV processing messages.
     * Messages here should be monitored and manually processed.
     */
    @Bean
    public Queue cvParserDeadLetterQueue() {
        return QueueBuilder
                .durable(CV_PARSER_DLQ)
                .build();
    }

    /**
     * Binding: cv_parser.jobs queue receives cv.uploaded events.
     */
    @Bean
    public Binding cvUploadedBinding(Queue cvParserQueue, TopicExchange talentflowEventsExchange) {
        return BindingBuilder
                .bind(cvParserQueue)
                .to(talentflowEventsExchange)
                .with(ROUTING_KEY_CV_UPLOADED);
    }

    /**
     * JSON message converter for serializing/deserializing events.
     */
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    /**
     * RabbitTemplate configured with JSON converter.
     */
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter jsonMessageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter);
        template.setExchange(EXCHANGE_NAME);
        return template;
    }
}
