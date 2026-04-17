package com.talentflow.cvparser.usecase;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.extractor.CvExtractorService;
import com.talentflow.cvparser.parser.ParserFactory;
import com.talentflow.cvparser.repository.CvParseResultRepository;
import com.talentflow.cvparser.shared.config.RabbitMqConfig;
import com.talentflow.cvparser.shared.dto.CvParsedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.shared.dto.ParsedCvData;
import com.talentflow.cvparser.storage.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class CvParsingUseCaseImpl implements CvParsingUseCase {

    // [Decision Log] Timeout 30 giây cho LLM extraction — ngắn hơn OCR (120s) vì
    // Gemini là network call, không phải CPU-bound.
    private static final long EXTRACTOR_TIMEOUT_SECONDS = 30L;

    private final StorageService storageService;
    private final ParserFactory parserFactory;
    private final CvExtractorService cvExtractorService;
    private final CvParseResultRepository cvParseResultRepository;
    private final RabbitTemplate rabbitTemplate;

    @Override
    public void execute(CvUploadedEvent event) throws Exception {
        log.info("[CVP-USECASE] Pipeline started. candidateId={}", event.getCandidateId());

        String rawText = parseRawText(event);
        log.debug("[CVP-USECASE] Parsed. candidateId={}, textLength={}", event.getCandidateId(), rawText.length());

        CandidateProfile profile = cvExtractorService
                .extract(rawText)
                .get(EXTRACTOR_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        log.info("[CVP-USECASE] Extracted. candidateId={}, status={}",
                event.getCandidateId(), profile.getExtractionStatus());

        cvParseResultRepository.save(event, profile);
        log.debug("[CVP-USECASE] Persisted. candidateId={}", event.getCandidateId());

        CvParsedEvent parsedEvent = CvParsedEvent.builder()
                .candidateId(event.getCandidateId())
                .applicationId(event.getApplicationId())
                .jobId(event.getJobId())
                .aiScore(0)
                .parsedData(toParsedCvData(profile))
                .scoringReasoning(null)
                .parsedAt(Instant.now())
                .build();
        rabbitTemplate.convertAndSend(RabbitMqConfig.ROUTING_KEY_CV_PARSED, parsedEvent);
        log.info("[CVP-USECASE] Pipeline completed. candidateId={}", event.getCandidateId());
    }

    private String parseRawText(CvUploadedEvent event) throws Exception {
        Path tempFile = storageService.downloadSafely(event.getFileKey());
        log.debug("[CVP-USECASE] Downloaded. candidateId={}, tempFile={}", event.getCandidateId(), tempFile);

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

    /**
     * Map CandidateProfile (internal extraction model) → ParsedCvData (event DTO).
     */
    private ParsedCvData toParsedCvData(CandidateProfile profile) {
        return ParsedCvData.builder()
                .fullName(profile.getFullName())
                .email(profile.getEmail())
                .phone(profile.getPhone())
                .skills(profile.getSkills())
                .build();
    }
}
