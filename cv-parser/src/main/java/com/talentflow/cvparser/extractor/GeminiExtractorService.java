package com.talentflow.cvparser.extractor;

import com.talentflow.cvparser.shared.exception.ExtractionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.concurrent.CompletableFuture;

/**
 * Primary {@link CvExtractorService} implementation.
 *
 * Strategy:
 *   1. Build prompt via {@link PromptBuilder}.
 *   2. Call Gemini via {@link GeminiLlmClient} (with CircuitBreaker + Retry + RateLimiter).
 *   3. Validate and parse the response via {@link GeminiResponseValidator}.
 *   4. On any failure → fall back to {@link RuleBasedExtractorService#extractSync}.
 *
 * Runs on {@code llmExecutor} so the RabbitMQ listener thread is never blocked.
 */
@Slf4j
@Service
@Primary
@RequiredArgsConstructor
public class GeminiExtractorService implements CvExtractorService {

    private final GeminiLlmClient geminiLlmClient;
    private final PromptBuilder promptBuilder;
    private final GeminiResponseValidator responseValidator;
    private final RuleBasedExtractorService ruleBasedExtractorService;

    @Override
    @Async("llmExecutor")
    public CompletableFuture<CandidateProfile> extract(String rawText) {
        log.info("[GEMINI-EXTRACTOR] Starting extraction. textLength={}", rawText.length());
        return extractWithGemini(rawText)
                .doOnNext(profile -> log.info(
                        "[GEMINI-EXTRACTOR] Gemini extraction succeeded. status={}", profile.getExtractionStatus()))
                .onErrorResume(e -> Mono.just(fallback(rawText, e)))
                .toFuture();
    }


    private Mono<CandidateProfile> extractWithGemini(String rawText) {
        CvExtractionPrompt prompt = promptBuilder.build(rawText);
        return geminiLlmClient.generate(prompt)
                .map(responseValidator::validateAndParse);
    }


    private CandidateProfile fallback(String rawText, Throwable cause) {
        String reason = cause instanceof ExtractionException ex
                ? ex.getErrorCode() + " — " + ex.getMessage()
                : cause.getClass().getSimpleName() + " — " + cause.getMessage();

        log.warn("[GEMINI-EXTRACTOR] Gemini failed, falling back to rule-based. reason={}", reason);

        try {
            CandidateProfile profile = ruleBasedExtractorService.extractSync(rawText);
            log.info("[GEMINI-EXTRACTOR] Fallback succeeded. status={}", profile.getExtractionStatus());
            return profile;
        } catch (Exception fallbackEx) {
            log.error("[GEMINI-EXTRACTOR] Both Gemini and rule-based extraction failed.", fallbackEx);
            return emptyProfile();
        }
    }

    private CandidateProfile emptyProfile() {
        return CandidateProfile.builder()
                .skills(java.util.List.of())
                .extractionStatus(ExtractionStatus.FAILED)
                .build();
    }
}
