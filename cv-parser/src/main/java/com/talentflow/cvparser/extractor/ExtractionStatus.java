package com.talentflow.cvparser.extractor;

public enum ExtractionStatus {
    /** All fields extracted successfully via Gemini LLM. */
    SUCCESS,
    /** Extraction ran but key identifiers (name/email) are missing. */
    PARTIAL,
    /** Gemini unavailable; regex fallback was used. */
    REGEX_FALLBACK,
    /** Both Gemini and rule-based extraction failed — no usable data. */
    FAILED
}
