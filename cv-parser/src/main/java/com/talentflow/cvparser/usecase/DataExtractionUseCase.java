package com.talentflow.cvparser.usecase;

import com.talentflow.cvparser.extractor.CandidateProfile;

public interface DataExtractionUseCase {

    /**
     * Extract structured data from raw CV text using a hybrid strategy:
     * Gemini LLM (primary) with automatic rule-based fallback.
     *
     * Always returns a non-null {@link CandidateProfile}; extraction status
     * reflects how much succeeded (SUCCESS / PARTIAL / REGEX_FALLBACK).
     *
     * @param rawText Raw text from PDF/DOCX/OCR — may be empty but not null.
     * @return Populated profile, never null.
     */
    CandidateProfile extract(String rawText);
}
