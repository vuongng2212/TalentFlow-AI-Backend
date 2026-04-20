package com.talentflow.cvparser.shared.exception;

/**
 * Exception thrown when a file exceeds the configured size limit.
 */
public class PayloadTooLargeException extends RuntimeException {

    public PayloadTooLargeException(String message) {
        super(message);
    }
}
