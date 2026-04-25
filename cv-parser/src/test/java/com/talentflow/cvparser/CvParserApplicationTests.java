package com.talentflow.cvparser;

import com.talentflow.cvparser.extractor.GeminiResponseValidator;
import com.talentflow.cvparser.extractor.PromptBuilder;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class CvParserApplicationTests {

    // Mock RabbitMQ connection so context loads without a running broker
    @MockBean
    ConnectionFactory connectionFactory;

    // Mock the validator to avoid @PostConstruct schema loading from classpath
    @MockBean
    GeminiResponseValidator geminiResponseValidator;

    // Mock the prompt builder to avoid @PostConstruct schema loading from classpath
    @MockBean
    PromptBuilder promptBuilder;

    @Test
    void contextLoads() {
    }

}
