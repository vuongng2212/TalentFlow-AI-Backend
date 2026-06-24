package com.talentflow.cvparser.usecase;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.parser.ParserFactory;
import com.talentflow.cvparser.repository.CvParseResultRepository;
import com.talentflow.cvparser.scoring.CandidateScoringUseCase;
import com.talentflow.cvparser.scoring.ScoringResult;
import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvParsedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.shared.dto.ParseStatus;
import com.talentflow.cvparser.shared.dto.ParsedCvData;
import com.talentflow.cvparser.shared.util.PiiRedactor;
import com.talentflow.cvparser.storage.StorageService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class CvParsingUseCaseImpl implements CvParsingUseCase {

    private static final String METRIC_DURATION = "cv_parsing_duration_seconds";
    private static final String METRIC_TOTAL = "cv_parsing_total";

    private final StorageService storageService;
    private final ParserFactory parserFactory;
    private final DataExtractionUseCase dataExtractionUseCase;
    private final CandidateScoringUseCase candidateScoringUseCase;
    private final CvParseResultRepository cvParseResultRepository;
    private final RabbitTemplate rabbitTemplate;

    private final PiiRedactor piiRedactor;
    private final Timer parsingTimer;
    private final Counter successCounter;
    private final Counter failedCounter;
    private final Counter partialCounter;

    public CvParsingUseCaseImpl(
            StorageService storageService,
            ParserFactory parserFactory,
            DataExtractionUseCase dataExtractionUseCase,
            CandidateScoringUseCase candidateScoringUseCase,
            CvParseResultRepository cvParseResultRepository,
            RabbitTemplate rabbitTemplate,
            MeterRegistry meterRegistry,
            PiiRedactor piiRedactor) {
        this.storageService = storageService;
        this.parserFactory = parserFactory;
        this.dataExtractionUseCase = dataExtractionUseCase;
        this.candidateScoringUseCase = candidateScoringUseCase;
        this.cvParseResultRepository = cvParseResultRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.piiRedactor = piiRedactor;

        this.parsingTimer = Timer.builder(METRIC_DURATION)
                .description("CV parsing pipeline duration")
                .register(meterRegistry);
        this.successCounter = Counter.builder(METRIC_TOTAL)
                .tag("status", "success")
                .register(meterRegistry);
        this.failedCounter = Counter.builder(METRIC_TOTAL)
                .tag("status", "failed")
                .register(meterRegistry);
        this.partialCounter = Counter.builder(METRIC_TOTAL)
                .tag("status", "partial")
                .register(meterRegistry);
    }

    @Override
    @Transactional
    public void execute(CvUploadedEvent event) throws Exception {
        Instant start = Instant.now();

        log.info("[CVP-USECASE] Pipeline started. candidateId={}, applicationId={}",
                event.getCandidateId(), event.getApplicationId());

        // Idempotency check: skip if already successfully processed
        if (cvParseResultRepository.existsByApplicationIdAndStatus(
                event.getApplicationId(), ParseStatus.SUCCESS)) {
            log.info("[CVP-USECASE] Idempotency hit — already processed. candidateId={}, applicationId={}",
                    event.getCandidateId(), event.getApplicationId());
            return;
        }

        try {
            String rawText = parseRawText(event);
            log.debug("[CVP-USECASE] Parsed. candidateId={}, textLength={}",
                    event.getCandidateId(), rawText.length());

            CandidateProfile profile = dataExtractionUseCase.extract(rawText);
            log.info("[CVP-USECASE] Extracted. candidateId={}, status={}",
                    event.getCandidateId(), profile.getExtractionStatus());

            // AI scoring against job description
            ScoringResult scoringResult = candidateScoringUseCase.score(
                    profile, event.getJobDescription());
            log.info("[CVP-USECASE] Scoring complete. candidateId={}, score={}, status={}",
                    event.getCandidateId(), scoringResult.getAiScore(), scoringResult.getScoringStatus());

            // Persist within the current transaction
            cvParseResultRepository.save(event, profile, scoringResult);
            log.debug("[CVP-USECASE] Persisted. candidateId={}", event.getCandidateId());

            // Record success metrics
            recordPipelineMetrics(start, ParseStatus.SUCCESS);

            // Post-commit publish: event is sent only after DB transaction commits
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            publishParsedEvent(event, profile, scoringResult);
                        }
                    }
            );
        } catch (Exception e) {
            log.error("[CVP-USECASE] Pipeline failed. candidateId={}, error={}",
                    event.getCandidateId(), e.getMessage());
            recordPipelineMetrics(start, ParseStatus.FAILED);
            throw e;
        }
    }

    private void recordPipelineMetrics(Instant start, ParseStatus status) {
        Duration duration = Duration.between(start, Instant.now());
        parsingTimer.record(duration.toMillis(), TimeUnit.MILLISECONDS);

        switch (status) {
            case SUCCESS -> successCounter.increment();
            case PARTIAL -> partialCounter.increment();
            case FAILED -> failedCounter.increment();
        }
    }

    private void publishParsedEvent(CvUploadedEvent event, CandidateProfile profile, ScoringResult scoringResult) {
        try {
            CvParsedEvent parsedEvent = CvParsedEvent.builder()
                    .candidateId(event.getCandidateId())
                    .applicationId(event.getApplicationId())
                    .jobId(event.getJobId())
                    .aiScore(scoringResult.getAiScore())
                    .parsedData(toParsedCvData(profile))
                    .scoringReasoning(scoringResult.getScoringReasoning())
                    .parsedAt(Instant.now())
                    .build();
            rabbitTemplate.convertAndSend(RabbitMqConfig.ROUTING_KEY_CV_PARSED, parsedEvent);
            log.info("[CVP-USECASE] Post-commit publish succeeded. candidateId={}, score={}",
                    event.getCandidateId(), scoringResult.getAiScore());
        } catch (Exception e) {
            log.error("[CVP-USECASE] Post-commit publish failed (DB already committed). candidateId={}",
                    event.getCandidateId(), e);
        }
    }

    private String parseRawText(CvUploadedEvent event) throws Exception {
        Path tempFile = storageService.downloadSafely(event.getFileKey());
        log.debug("[CVP-USECASE] Downloaded. candidateId={}, tempFile={}",
                event.getCandidateId(), tempFile);

        try {
            return parserFactory.parse(tempFile);
        } finally {
            deleteTempFile(tempFile);
        }
    }

    private void deleteTempFile(Path tempFile) {
        try {
            Files.deleteIfExists(tempFile);
            log.debug("[CVP-USECASE] TempFile deleted. path={}", tempFile);
        } catch (Exception deleteEx) {
            log.warn("[CVP-USECASE] Failed to delete TempFile. path={}", tempFile, deleteEx);
        }
    }

    private ParsedCvData toParsedCvData(CandidateProfile profile) {
        return ParsedCvData.builder()
                .fullName(profile.getFullName())
                .email(profile.getEmail())
                .phone(profile.getPhone())
                .linkedIn(profile.getLinkedIn())
                .summary(profile.getSummary())
                .skills(profile.getSkills())
                .experience(mapExperience(profile.getExperience()))
                .education(mapEducation(profile.getEducation()))
                .build();
    }

    private List<ParsedCvData.Experience> mapExperience(
            List<CandidateProfile.WorkExperience> src) {
        if (src == null) return List.of();
        return src.stream()
                .map(e -> ParsedCvData.Experience.builder()
                        .title(e.getTitle())
                        .company(e.getCompany())
                        .startDate(e.getStartDate())
                        .endDate(e.getEndDate())
                        .description(e.getDescription())
                        .build())
                .toList();
    }

    private List<ParsedCvData.Education> mapEducation(
            List<CandidateProfile.EducationEntry> src) {
        if (src == null) return List.of();
        return src.stream()
                .map(e -> ParsedCvData.Education.builder()
                        .degree(e.getDegree())
                        .institution(e.getInstitution())
                        .graduationYear(e.getGraduationYear())
                        .build())
                .toList();
    }
}
