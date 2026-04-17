package com.talentflow.cvparser;

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

    @Test
    void contextLoads() {
    }

}
