package com.talent.cvparser.shared.exception;

public class StorageReadException extends RuntimeException {
    public StorageReadException(String message, Throwable cause)
    {
        super(message, cause);
    }
}
