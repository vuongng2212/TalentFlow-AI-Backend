package com.talentflow.cvparser.shared.exception;

/**
 * Exception thrown when document parsing fails.
 * Examples: corrupted PDF, password-protected file, unsupported format.
 */
public class ParsingException extends RuntimeException {

    private final String errorCode;
    private final boolean retryable;

    public ParsingException(String message) {
        super(message);
        this.errorCode = "PARSING_FAILED";
        this.retryable = false;
    }

    public ParsingException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
        this.retryable = false;
    }

    public ParsingException(String message, String errorCode, boolean retryable) {
        super(message);
        this.errorCode = errorCode;
        this.retryable = retryable;
    }

    public ParsingException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = "PARSING_FAILED";
        this.retryable = false;
    }

    public ParsingException(String message, String errorCode, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.retryable = false;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public boolean isRetryable() {
        return retryable;
    }
}
