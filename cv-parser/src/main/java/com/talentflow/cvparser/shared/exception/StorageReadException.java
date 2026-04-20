package com.talentflow.cvparser.shared.exception;

/**
 * Exception thrown when an I/O error occurs while reading from S3.
 */
public class StorageReadException extends RuntimeException {

    public StorageReadException(String message, Throwable cause) {
        super(message, cause);
    }
}
