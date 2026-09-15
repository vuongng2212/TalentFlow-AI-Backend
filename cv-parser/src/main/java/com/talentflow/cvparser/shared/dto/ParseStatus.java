package com.talentflow.cvparser.shared.dto;

/**
 * Status of the CV parse operation.
 * Persisted to the cv_parse_results table.
 */
public enum ParseStatus {
    /** All processing steps completed successfully. */
    SUCCESS,
    /** Processing completed but with partial results (e.g., limited data extracted). */
    PARTIAL,
    /** Processing failed irrecoverably. */
    FAILED
}
