package com.talent.cvparser.shared.exception;

public class ParsingException extends RuntimeException {
    public ParsingException(String message, Throwable cause) {
        super(message, cause);
    }

    public ParsingException(String message) {
        super(message);
    }
}
