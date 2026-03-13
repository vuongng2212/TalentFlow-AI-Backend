package com.talentflow.cvparser.shared.exception;

/**
 * Exception thrown when data extraction fails.
 * Examples: LLM timeout, invalid response format, missing required fields.
 */
public class ExtractionException extends RuntimeException {

    private final String errorCode;
    private final boolean retryable;

    public ExtractionException(String message) {
        super(message);
        this.errorCode = "EXTRACTION_FAILED";
        this.retryable = false;
    }

    public ExtractionException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
        this.retryable = false;
    }

    public ExtractionException(String message, String errorCode, boolean retryable) {
        super(message);
        this.errorCode = errorCode;
        this.retryable = retryable;
    }

    public ExtractionException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = "EXTRACTION_FAILED";
        this.retryable = false;
    }

    public ExtractionException(String message, String errorCode, boolean retryable, Throwable cause) {
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
