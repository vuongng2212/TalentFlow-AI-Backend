package com.talentflow.cvparser.extractor;

/**
 * Indicates the mechanism that produced a {@link CandidateProfile},
 * not the completeness of the data. Completeness is conveyed by the
 * populated fields themselves.
 */
public enum ExtractionStatus {
    /** Gemini LLM ran and returned both name and email. */
    SUCCESS,
    /** Gemini LLM ran cleanly but key identifiers (name/email) are missing. */
    PARTIAL,
    /** Gemini path failed; rule-based regex fallback was used. */
    REGEX_FALLBACK,
    /** Both Gemini and rule-based extraction failed — no usable data. */
    FAILED
}
