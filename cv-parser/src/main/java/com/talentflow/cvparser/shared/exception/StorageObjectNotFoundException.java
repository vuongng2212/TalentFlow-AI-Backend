package com.talentflow.cvparser.shared.exception;

/**
 * Exception thrown when a requested S3 object does not exist.
 */
public class StorageObjectNotFoundException extends RuntimeException {

    public StorageObjectNotFoundException(String message) {
        super(message);
    }
}
