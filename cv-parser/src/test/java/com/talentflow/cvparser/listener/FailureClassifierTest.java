package com.talentflow.cvparser.listener;

import com.talentflow.cvparser.shared.dto.CvFailedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.shared.exception.*;
import com.talentflow.cvparser.shared.util.PiiRedactor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class FailureClassifierTest {

    private FailureClassifier classifier;

    @BeforeEach
    void setUp() {
        classifier = new FailureClassifier(new PiiRedactor());
    }

    @Test
    void shouldClassifyRetryableExceptions() {
        assertThat(classifier.isRetryable(new StorageReadException("Timeout", new java.io.IOException()))).isTrue();
        assertThat(classifier.isRetryable(new ScoringException("LLM timeout", "SCORING_TIMEOUT", true))).isTrue();
        assertThat(classifier.isRetryable(new ExtractionException("Network error", "EXTRACTION_TIMEOUT", true))).isTrue();
    }

    @Test
    void shouldClassifyNonRetryableExceptions() {
        assertThat(classifier.isRetryable(new StorageObjectNotFoundException("File not found"))).isFalse();
        assertThat(classifier.isRetryable(new PayloadTooLargeException("Too large"))).isFalse();
        assertThat(classifier.isRetryable(new UnsupportedDocumentFormatException("Bad format"))).isFalse();
        assertThat(classifier.isRetryable(new RuntimeException("Unknown crash"))).isFalse();
    }

    @Test
    void shouldExtractExpectedErrorCodes() {
        assertThat(classifier.extractErrorCode(new StorageReadException("Timeout", null))).isEqualTo("STORAGE_READ_ERROR");
        assertThat(classifier.extractErrorCode(new StorageObjectNotFoundException("Not found"))).isEqualTo("FILE_NOT_FOUND");
        assertThat(classifier.extractErrorCode(new PayloadTooLargeException("Large"))).isEqualTo("PAYLOAD_TOO_LARGE");
        assertThat(classifier.extractErrorCode(new UnsupportedDocumentFormatException("Bad format"))).isEqualTo("UNSUPPORTED_FORMAT");
        assertThat(classifier.extractErrorCode(new DocumentTooLongException("Too long"))).isEqualTo("DOCUMENT_TOO_LONG");
        assertThat(classifier.extractErrorCode(new ScoringException("Failed", "CUSTOM_SCORING_ERR", false))).isEqualTo("CUSTOM_SCORING_ERR");
        assertThat(classifier.extractErrorCode(new RuntimeException("Random exception"))).isEqualTo("PARSING_FAILED");
    }

    @Test
    void shouldClassifyToCvFailedEventWithRedactedMessage() {
        CvUploadedEvent uploadedEvent = CvUploadedEvent.builder()
                .candidateId("3fa85f64-5717-4562-b3fc-2c963f66afa6")
                .applicationId("3fa85f64-5717-4562-b3fc-2c963f66afa7")
                .jobId("3fa85f64-5717-4562-b3fc-2c963f66afa8")
                .bucket("talentflow-cvs")
                .fileKey("test.pdf")
                .mimeType("application/pdf")
                .uploadedAt(Instant.now())
                .build();

        Exception ex = new StorageReadException("S3 error for user@example.com", null);
        CvFailedEvent failedEvent = classifier.classify(uploadedEvent, ex, true);

        assertThat(failedEvent.getCandidateId()).isEqualTo("3fa85f64-5717-4562-b3fc-2c963f66afa6");
        assertThat(failedEvent.getApplicationId()).isEqualTo("3fa85f64-5717-4562-b3fc-2c963f66afa7");
        assertThat(failedEvent.getJobId()).isEqualTo("3fa85f64-5717-4562-b3fc-2c963f66afa8");
        assertThat(failedEvent.getErrorCode()).isEqualTo("STORAGE_READ_ERROR");
        assertThat(failedEvent.getRetryable()).isTrue();
        assertThat(failedEvent.getFailedAt()).isNotNull();
        assertThat(failedEvent.getErrorMessage()).doesNotContain("user@example.com");
    }
}
