package com.talent.cvparser.shared.exception;

public class PayloadTooLargeException extends RuntimeException{
    public PayloadTooLargeException(String message) {
        super(message);
    }
}
