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
 * <p>Infrastructure beans that require external services are replaced with mocks:
 * <ul>
 *   <li>{@code ConnectionFactory} — avoids needing a running RabbitMQ broker</li>
 *   <li>{@code S3Client} — avoids needing a running S3-compatible store</li>
 * </ul>
 * JPA uses H2 in-memory database via the {@code test} profile.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
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
