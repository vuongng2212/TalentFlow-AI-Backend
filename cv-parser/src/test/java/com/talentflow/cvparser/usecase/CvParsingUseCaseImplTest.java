package com.talentflow.cvparser.usecase;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.extractor.ExtractionStatus;
import com.talentflow.cvparser.parser.ParserFactory;
import com.talentflow.cvparser.repository.CvParseResultRepository;
import com.talentflow.cvparser.scoring.CandidateScoringUseCase;
import com.talentflow.cvparser.scoring.ScoringResult;
import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvParsedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.storage.StorageService;
import com.talentflow.cvparser.shared.util.PiiRedactor;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CvParsingUseCaseImplTest {

    private final StorageService storageService = mock(StorageService.class);
    private final ParserFactory parserFactory = mock(ParserFactory.class);
    private final DataExtractionUseCase dataExtractionUseCase = mock(DataExtractionUseCase.class);
    private final CvParseResultRepository cvParseResultRepository = mock(CvParseResultRepository.class);
    private final RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);

    private final CandidateScoringUseCase candidateScoringUseCase = mock(CandidateScoringUseCase.class);
    private final MeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final PiiRedactor piiRedactor = new PiiRedactor();

    private final CvParsingUseCaseImpl useCase = new CvParsingUseCaseImpl(
            storageService,
            parserFactory,
            dataExtractionUseCase,
            candidateScoringUseCase,
            cvParseResultRepository,
            rabbitTemplate,
            meterRegistry,
            piiRedactor
    );

    @BeforeEach
    void initTransaction() {
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach
    void cleanTransaction() {
        TransactionSynchronizationManager.clear();
    }

    /**
     * Trigger post-commit synchronizations that were registered during execute().
     * In a Spring-managed transaction this fires automatically; in mock tests
     * we must invoke it manually.
     */
    private static void triggerAfterCommit() {
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit);
    }

    @Test
    void executeDeletesTempFileOnSuccess() throws Exception {
        Path tempFile = Files.createTempFile("cv-success-", ".tmp");
        CvUploadedEvent event = sampleEvent();

        when(storageService.downloadSafely(event.getFileKey())).thenReturn(tempFile);
        when(parserFactory.parse(tempFile)).thenReturn("raw text");
        when(dataExtractionUseCase.extract("raw text")).thenReturn(sampleProfile());
        when(candidateScoringUseCase.score(any(), any()))
                .thenReturn(new ScoringResult(85, "Good match", com.talentflow.cvparser.shared.dto.ScoringStatus.SUCCESS));

        useCase.execute(event);
        triggerAfterCommit();

        assertThat(Files.exists(tempFile)).isFalse();
        verify(cvParseResultRepository).save(eq(event), any(CandidateProfile.class), any(ScoringResult.class));
        verify(rabbitTemplate).convertAndSend(eq(RabbitMqConfig.ROUTING_KEY_CV_PARSED), any(CvParsedEvent.class));
    }

    @Test
    void executeDeletesTempFileWhenParseFails() throws Exception {
        Path tempFile = Files.createTempFile("cv-parse-fail-", ".tmp");
        CvUploadedEvent event = sampleEvent();

        when(storageService.downloadSafely(event.getFileKey())).thenReturn(tempFile);
        when(parserFactory.parse(tempFile)).thenThrow(new RuntimeException("parse failed"));

        assertThatThrownBy(() -> useCase.execute(event))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("parse failed");

        assertThat(Files.exists(tempFile)).isFalse();
        verify(dataExtractionUseCase, never()).extract(any());
        verify(cvParseResultRepository, never()).save(any(), any(), any());
    }

    @Test
    void executeContinuesWhenExtractionReturnsFailedProfile() throws Exception {
        // DataExtractionUseCase no longer throws — it absorbs failures and returns
        // a FAILED profile. The pipeline should still persist + publish.
        Path tempFile = Files.createTempFile("cv-extract-failed-", ".tmp");
        CvUploadedEvent event = sampleEvent();

        when(storageService.downloadSafely(event.getFileKey())).thenReturn(tempFile);
        when(parserFactory.parse(tempFile)).thenReturn("raw text");
        when(dataExtractionUseCase.extract("raw text")).thenReturn(failedProfile());
        when(candidateScoringUseCase.score(any(), any()))
                .thenReturn(new ScoringResult(50, "Fallback", com.talentflow.cvparser.shared.dto.ScoringStatus.FALLBACK));

        useCase.execute(event);
        triggerAfterCommit();

        assertThat(Files.exists(tempFile)).isFalse();
        verify(cvParseResultRepository).save(eq(event), any(CandidateProfile.class), any(ScoringResult.class));
        verify(rabbitTemplate).convertAndSend(eq(RabbitMqConfig.ROUTING_KEY_CV_PARSED), any(CvParsedEvent.class));
    }

    @Test
    void executeDeletesTempFileWhenPersistenceFails() throws Exception {
        Path tempFile = Files.createTempFile("cv-persist-fail-", ".tmp");
        CvUploadedEvent event = sampleEvent();

        when(storageService.downloadSafely(event.getFileKey())).thenReturn(tempFile);
        when(parserFactory.parse(tempFile)).thenReturn("raw text");
        when(dataExtractionUseCase.extract("raw text")).thenReturn(sampleProfile());
        when(candidateScoringUseCase.score(any(), any()))
                .thenReturn(new ScoringResult(85, "Good match", com.talentflow.cvparser.shared.dto.ScoringStatus.SUCCESS));
        doThrow(new RuntimeException("db failed"))
                .when(cvParseResultRepository).save(eq(event), any(CandidateProfile.class), any(ScoringResult.class));

        assertThatThrownBy(() -> useCase.execute(event))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("db failed");

        assertThat(Files.exists(tempFile)).isFalse();
        verify(rabbitTemplate, never()).convertAndSend(any(String.class), any(Object.class));
    }

    private CvUploadedEvent sampleEvent() {
        return CvUploadedEvent.builder()
                .candidateId("11111111-1111-1111-1111-111111111111")
                .applicationId("22222222-2222-2222-2222-222222222222")
                .jobId("33333333-3333-3333-3333-333333333333")
                .bucket("talentflow-cvs")
                .fileKey("cvs/sample.pdf")
                .mimeType("application/pdf")
                .uploadedAt(Instant.now())
                .build();
    }

    private CandidateProfile sampleProfile() {
        return CandidateProfile.builder()
                .fullName("Alice")
                .email("alice@example.com")
                .phone("0123456789")
                .skills(List.of("Java"))
                .extractionStatus(ExtractionStatus.SUCCESS)
                .build();
    }

    private CandidateProfile failedProfile() {
        return CandidateProfile.builder()
                .skills(List.of())
                .extractionStatus(ExtractionStatus.FAILED)
                .build();
    }
}
