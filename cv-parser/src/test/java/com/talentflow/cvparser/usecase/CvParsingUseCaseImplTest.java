package com.talentflow.cvparser.usecase;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.extractor.CvExtractorService;
import com.talentflow.cvparser.parser.ParserFactory;
import com.talentflow.cvparser.repository.CvParseResultRepository;
import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvParsedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.storage.StorageService;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CvParsingUseCaseImplTest {

    private final StorageService storageService = mock(StorageService.class);
    private final ParserFactory parserFactory = mock(ParserFactory.class);
    private final CvExtractorService cvExtractorService = mock(CvExtractorService.class);
    private final CvParseResultRepository cvParseResultRepository = mock(CvParseResultRepository.class);
    private final RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);

    private final CvParsingUseCaseImpl useCase = new CvParsingUseCaseImpl(
            storageService,
            parserFactory,
            cvExtractorService,
            cvParseResultRepository,
            rabbitTemplate
    );

    @Test
    void executeDeletesTempFileOnSuccess() throws Exception {
        Path tempFile = Files.createTempFile("cv-success-", ".tmp");
        CvUploadedEvent event = sampleEvent();

        when(storageService.downloadSafely(event.getFileKey())).thenReturn(tempFile);
        when(parserFactory.parse(tempFile)).thenReturn("raw text");
        when(cvExtractorService.extract("raw text")).thenReturn(CompletableFuture.completedFuture(sampleProfile()));

        useCase.execute(event);

        assertThat(Files.exists(tempFile)).isFalse();
        verify(cvParseResultRepository).save(eq(event), any(CandidateProfile.class));
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
        verify(cvExtractorService, never()).extract(any());
        verify(cvParseResultRepository, never()).save(any(), any());
    }

    @Test
    void executeDeletesTempFileWhenExtractionFails() throws Exception {
        Path tempFile = Files.createTempFile("cv-extract-fail-", ".tmp");
        CvUploadedEvent event = sampleEvent();

        when(storageService.downloadSafely(event.getFileKey())).thenReturn(tempFile);
        when(parserFactory.parse(tempFile)).thenReturn("raw text");
        when(cvExtractorService.extract("raw text"))
                .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("llm failed")));

        assertThatThrownBy(() -> useCase.execute(event))
                .isInstanceOf(Exception.class)
                .hasMessageContaining("llm failed");

        assertThat(Files.exists(tempFile)).isFalse();
        verify(cvParseResultRepository, never()).save(any(), any());
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
                .extractionStatus("SUCCESS")
                .build();
    }
}
