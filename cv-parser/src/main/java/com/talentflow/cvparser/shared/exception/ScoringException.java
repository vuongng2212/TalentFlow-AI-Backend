package com.talentflow.cvparser.shared.exception;

/**
 * Exception thrown when AI scoring fails.
 * Examples: API error, invalid job requirements, scoring service unavailable.
 */
public class ScoringException extends RuntimeException {

    private final String errorCode;
    private final boolean retryable;

    public ScoringException(String message) {
        super(message);
        this.errorCode = "SCORING_FAILED";
        this.retryable = false;
    }

    public ScoringException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
        this.retryable = false;
    }

    public ScoringException(String message, String errorCode, boolean retryable) {
        super(message);
        this.errorCode = errorCode;
        this.retryable = retryable;
    }

    public ScoringException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = "SCORING_FAILED";
        this.retryable = true; // Scoring failures are often transient
    }

    public ScoringException(String message, String errorCode, boolean retryable, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.retryable = retryable;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public boolean isRetryable() {
        return retryable;
    }
}
