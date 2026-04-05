package com.talent.cvparser.extractor;

import java.util.concurrent.CompletableFuture;

public interface CvExtractorService {

    /**
     * Trích xuất thông tin có cấu trúc từ raw text CV.
     *
     * Implement bởi GeminiExtractorService (CVP-017) với CircuitBreaker + TimeLimiter.
     * Fallback tự động bằng Regex khi Gemini không available.
     *
     * @param rawText Raw text đã extract từ PDF/DOCX/OCR — đã được sanitize
     * @return CandidateProfile với extractionStatus = SUCCESS / PARTIAL / REGEX_FALLBACK
     */
    CompletableFuture<CandidateProfile> extract(String rawText);
}