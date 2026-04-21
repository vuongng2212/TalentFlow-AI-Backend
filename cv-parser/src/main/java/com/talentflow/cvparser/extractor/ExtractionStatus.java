package com.talentflow.cvparser.extractor;

public enum ExtractionStatus {
    /** All fields extracted successfully via Gemini LLM. */
    SUCCESS,
    /** Key fields found (email present) but some fields are missing. */
    PARTIAL,
    /** Gemini unavailable; regex fallback was used. */
    REGEX_FALLBACK
}
