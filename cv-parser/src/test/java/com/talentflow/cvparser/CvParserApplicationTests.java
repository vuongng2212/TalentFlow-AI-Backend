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
 * Heavy infrastructure auto-configurations (JPA, DataSource) are excluded via
 * properties so the test can run in CI without a database.  RabbitMQ and S3
 * infrastructure beans are replaced with mocks.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.autoconfigure.exclude="
                        + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
                        + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
                        + "org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration"
        }
)
@ActiveProfiles("test")
class CvParserApplicationTests {

    // RabbitMQ — provides the ConnectionFactory that RabbitMqConfig and listeners need
    @MockBean
    ConnectionFactory connectionFactory;

    // S3 — created by S3Config @Bean, needs mock to avoid real S3 connection
    @MockBean
    S3Client s3Client;

    @Test
    void contextLoads() {
    }

}
