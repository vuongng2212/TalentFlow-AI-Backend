package com.talentflow.cvparser.shared.exception;

/**
 * Exception thrown when a document format is not supported (not PDF or DOCX).
 */
public class UnsupportedDocumentFormatException extends ParsingException {

    public UnsupportedDocumentFormatException(String message) {
        super(message, "UNSUPPORTED_FORMAT");
    }
}
