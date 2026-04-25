package com.talentflow.cvparser;

import com.talentflow.cvparser.extractor.GeminiResponseValidator;
import com.talentflow.cvparser.extractor.PromptBuilder;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import software.amazon.awssdk.services.s3.S3Client;

/**
 * Smoke test: verifies the Spring ApplicationContext loads successfully.
 *
 * External infrastructure beans are replaced with mocks so the test can run
 * in CI without a real RabbitMQ broker, S3-compatible store, or Tesseract.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class CvParserApplicationTests {

    // ── Infrastructure mocks ─────────────────────────────────────────────
    @MockBean
    ConnectionFactory connectionFactory;

    @MockBean
    S3Client s3Client;

    // ── Beans whose @PostConstruct loads classpath resources ──────────────
    @MockBean
    GeminiResponseValidator geminiResponseValidator;

    @MockBean
    PromptBuilder promptBuilder;

    @Test
    void contextLoads() {
    }

}
