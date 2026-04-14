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

        Path tempFile = null;
        try {
            // ── STEP 1: Download safely từ S3/R2/MinIO ───────────────────────
            tempFile = storageService.downloadSafely(event.getFileKey());
            log.debug("[CVP-USECASE] Downloaded. candidateId={}, tempFile={}", event.getCandidateId(), tempFile);

            // ── STEP 2: Parse text (PDF / DOCX / OCR fallback) ───────────────
            // [Decision Log] ParserFactory tự xử lý: detect MIME → route parser →
            // trigger OCR nếu text < threshold. UseCase không cần biết định dạng file.
            String rawText = parserFactory.parse(tempFile);
            log.debug("[CVP-USECASE] Parsed. candidateId={}, textLength={}", event.getCandidateId(), rawText.length());

            // ── STEP 3: LLM Extraction với CircuitBreaker + Regex fallback ────
            CandidateProfile profile = cvExtractorService
                    .extract(rawText)
                    .get(EXTRACTOR_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            log.info("[CVP-USECASE] Extracted. candidateId={}, status={}",
                    event.getCandidateId(), profile.getExtractionStatus());

            // ── STEP 4: Persist kết quả vào DB ───────────────────────────────
            cvParseResultRepository.save(event, profile);
            log.debug("[CVP-USECASE] Persisted. candidateId={}", event.getCandidateId());

            // ── STEP 5: Publish completion event ─────────────────────────────
            // [Decision Log] Publish SAU KHI persist thành công — đảm bảo
            // downstream service không query DB trước khi data sẵn sàng.
            CvParsedEvent parsedEvent = CvParsedEvent.builder()
                    .candidateId(event.getCandidateId())
                    .applicationId(event.getApplicationId())
                    .jobId(event.getJobId())
                    .aiScore(0) // Placeholder — AI scoring implemented in next phase
                    .parsedData(toParsedCvData(profile))
                    .scoringReasoning(null)
                    .parsedAt(Instant.now())
                    .build();
            rabbitTemplate.convertAndSend(RabbitMqConfig.ROUTING_KEY_CV_PARSED, parsedEvent);
            log.info("[CVP-USECASE] Pipeline completed. candidateId={}", event.getCandidateId());

        } finally {
            // ── CLEANUP: Xóa TempFile dù thành công hay thất bại ─────────────
            // [Decision Log] finally block đảm bảo TempFile luôn được xóa.
            // Không cleanup → /tmp đầy sau nhiều ngày chạy production.
            if (tempFile != null) {
                try {
                    Files.deleteIfExists(tempFile);
                    log.debug("[CVP-USECASE] TempFile deleted. path={}", tempFile);
                } catch (Exception deleteEx) {
                    log.warn("[CVP-USECASE] Failed to delete TempFile. path={}", tempFile, deleteEx);
                }
            }
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
