package com.talentflow.cvparser;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import software.amazon.awssdk.services.s3.S3Client;

/**
 * Smoke test: verifies the Spring ApplicationContext loads successfully.
 *
 * <p>RabbitMQ auto-configuration is excluded to prevent listener containers from
 * starting (they would try to open real connections via the mocked ConnectionFactory).
 * JPA/DataSource is left enabled — H2 in-memory DB handles it in the test profile.</p>
 *
 * <p>The {@code ConnectionFactory} mock satisfies {@code RabbitMqConfig#rabbitTemplate()},
 * and the {@code S3Client} mock satisfies {@code S3StorageService}.</p>
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration",
                "spring.jpa.hibernate.ddl-auto=create-drop"
        }
)
@ActiveProfiles("test")
class CvParserApplicationTests {

    @MockBean
    ConnectionFactory connectionFactory;

    @MockBean
    S3Client s3Client;

    @Test
    void contextLoads() {
    }

}
