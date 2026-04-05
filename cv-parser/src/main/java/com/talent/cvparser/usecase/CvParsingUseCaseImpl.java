package com.talent.cvparser.usecase;

import com.talent.cvparser.extractor.CandidateProfile;
import com.talent.cvparser.extractor.CvExtractorService;
import com.talent.cvparser.listener.CvParsedEvent;
import com.talent.cvparser.listener.CvUploadEvent;
import com.talent.cvparser.parser.ParserFactory;
import com.talent.cvparser.repository.CvParseResultRepository;
import com.talent.cvparser.shared.config.RabbitMqConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class CvParsingUseCaseImpl implements CvParsingUseCase {

    // [Decision Log] Timeout 30 giây cho LLM extraction — ngắn hơn OCR (120s) vì
    // Gemini là network call, không phải CPU-bound. TimeLimiter trong Resilience4j
    // sẽ bắt timeout trước, UseCase chỉ cần .get() với buffer an toàn.
    private static final long EXTRACTOR_TIMEOUT_SECONDS = 30L;

    private final com.talent.cvparser.storage.StorageService storageService;
    private final ParserFactory parserFactory;
    private final CvExtractorService cvExtractorService;
    private final CvParseResultRepository cvParseResultRepository;
    private final RabbitTemplate rabbitTemplate;

    @Override
    public void execute(CvUploadEvent event) throws Exception {
        log.info("[CVP-USECASE] Pipeline started. cvId={}", event.getCvId());

        Path tempFile = null;
        try {
            // ── STEP 1: Download safely từ S3/R2/MinIO ───────────────────────
            tempFile = storageService.downloadSafely(event.getObjectKey());
            log.debug("[CVP-USECASE] Downloaded. cvId={}, tempFile={}", event.getCvId(), tempFile);

            // ── STEP 2: Parse text (PDF / DOCX / OCR fallback) ───────────────
            // [Decision Log] ParserFactory tự xử lý toàn bộ:
            // detect MIME → route parser → trigger OCR nếu text < threshold.
            // UseCase không cần biết file là PDF hay DOCX.
            String rawText = parserFactory.parse(tempFile);
            log.debug("[CVP-USECASE] Parsed. cvId={}, textLength={}", event.getCvId(), rawText.length());

            // ── STEP 3: LLM Extraction với CircuitBreaker + Regex fallback ────
            CandidateProfile profile = cvExtractorService
                    .extract(rawText)
                    .get(EXTRACTOR_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            log.info("[CVP-USECASE] Extracted. cvId={}, status={}",
                    event.getCvId(), profile.getExtractionStatus());

            // ── STEP 4: Persist kết quả vào DB ───────────────────────────────
            cvParseResultRepository.save(event, profile);
            log.debug("[CVP-USECASE] Persisted. cvId={}", event.getCvId());

            // ── STEP 5: Publish completion event ─────────────────────────────
            // [Decision Log] Publish SAU KHI persist thành công — đảm bảo
            // downstream service không query DB trước khi data sẵn sàng.
            CvParsedEvent parsedEvent = new CvParsedEvent(
                    event.getCvId(),
                    event.getApplicantId(),
                    event.getJobId(),
                    profile.getExtractionStatus()
            );
            rabbitTemplate.convertAndSend(RabbitMqConfig.CV_PARSED_QUEUE, parsedEvent);
            log.info("[CVP-USECASE] Pipeline completed. cvId={}", event.getCvId());

        } finally {
            // ── CLEANUP: Xóa TempFile dù thành công hay thất bại ─────────────
            // [Decision Log] finally block đảm bảo TempFile luôn được xóa.
            // Không cleanup → /tmp đầy sau nhiều ngày chạy production.
            // Listener không biết tempFile ở đâu — UseCase phải tự dọn.
            deleteTempFile(tempFile, event.getCvId());
        }
    }

    private void deleteTempFile(Path tempFile, String cvId) {
        if (tempFile == null) return;
        try {
            Files.deleteIfExists(tempFile);
            log.debug("[CVP-USECASE] TempFile deleted. cvId={}, path={}", cvId, tempFile);
        } catch (Exception e) {
            // [Decision Log] Log warn thay vì throw — không để cleanup failure
            // mask exception thật của pipeline đang propagate lên Listener.
            log.warn("[CVP-USECASE] Failed to delete TempFile. cvId={}, path={}", cvId, tempFile, e);
        }
    }
}