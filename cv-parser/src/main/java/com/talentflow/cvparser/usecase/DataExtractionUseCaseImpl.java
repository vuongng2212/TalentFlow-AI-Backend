package com.talentflow.cvparser.usecase;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.extractor.CvExtractorService;
import com.talentflow.cvparser.extractor.ExtractionStatus;
import com.talentflow.cvparser.extractor.RuleBasedExtractorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Hybrid extraction strategy:
 *
 * <pre>
 *   rawText too short?
 *     └─ YES → RuleBased directly (skip LLM round-trip)
 *     └─ NO  → GeminiExtractorService (Gemini + internal fallback)
 *                 │
 *                 ├─ completes within timeout? → return profile
 *                 └─ TimeoutException / failure → RuleBased as last resort
 * </pre>
 *
 * Owns the extraction timeout so {@link CvParsingUseCaseImpl} stays
 * focused on pipeline orchestration only.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataExtractionUseCaseImpl implements DataExtractionUseCase {

    private final CvExtractorService cvExtractorService;
    private final RuleBasedExtractorService ruleBasedExtractorService;

    @Value("${llm.extraction-timeout-seconds:20}")
    private long timeoutSeconds;

    @Value("${llm.min-text-length:50}")
    private int minLlmTextLength;

    @Override
    public CandidateProfile extract(String rawText) {
        if (rawText == null || rawText.length() < minLlmTextLength) {
            log.info("[DATA-EXTRACTION] Text too short ({} chars, min={}) — skipping LLM, using rule-based.",
                    rawText == null ? 0 : rawText.length(), minLlmTextLength);
            return rawText == null ? emptyProfile() : ruleBasedExtractorService.extractSync(rawText);
        }

        log.info("[DATA-EXTRACTION] Starting hybrid extraction. textLength={}, timeoutSeconds={}",
                rawText.length(), timeoutSeconds);

        try {
            CandidateProfile profile = cvExtractorService
                    .extract(rawText)
                    .get(timeoutSeconds, TimeUnit.SECONDS);

            log.info("[DATA-EXTRACTION] Extraction completed. status={}", profile.getExtractionStatus());
            return profile;

        } catch (TimeoutException e) {
            log.warn("[DATA-EXTRACTION] Extraction timed out after {}s — using rule-based as last resort.",
                    timeoutSeconds);
            return ruleBasedExtractorService.extractSync(rawText);

        } catch (ExecutionException e) {
            log.warn("[DATA-EXTRACTION] Extraction failed — using rule-based as last resort. reason={}",
                    e.getCause() != null ? e.getCause().getMessage() : e.getMessage());
            return ruleBasedExtractorService.extractSync(rawText);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[DATA-EXTRACTION] Extraction interrupted — using rule-based as last resort.");
            return ruleBasedExtractorService.extractSync(rawText);
        }
    }

    private CandidateProfile emptyProfile() {
        return CandidateProfile.builder()
                .skills(List.of())
                .extractionStatus(ExtractionStatus.FAILED)
                .build();
    }
}
