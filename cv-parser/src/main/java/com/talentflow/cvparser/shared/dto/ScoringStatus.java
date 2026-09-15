package com.talentflow.cvparser.shared.dto;

/**
 * Status of the AI scoring operation.
 */
public enum ScoringStatus {
    /** Gemini returned a valid score. */
    SUCCESS,
    /** Gemini was unavailable or returned invalid data; fallback score used. */
    FALLBACK,
    /** Scoring was skipped (e.g., no job description provided). */
    SKIPPED
}
