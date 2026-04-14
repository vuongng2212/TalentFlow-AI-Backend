package com.talentflow.cvparser.shared.exception;

/**
 * Exception thrown when a document exceeds the maximum allowed text or page length.
 */
public class DocumentTooLongException extends ParsingException {

    public DocumentTooLongException(String message) {
        super(message, "DOCUMENT_TOO_LONG");
    }
}
