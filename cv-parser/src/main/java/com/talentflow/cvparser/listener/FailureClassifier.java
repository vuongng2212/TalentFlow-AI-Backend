package com.talentflow.cvparser.listener;

import com.talentflow.cvparser.shared.dto.CvFailedEvent;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.shared.exception.*;
import com.talentflow.cvparser.shared.util.PiiRedactor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@RequiredArgsConstructor
public class FailureClassifier {

    private final PiiRedactor piiRedactor;

    public boolean isRetryable(Throwable cause) {
        if (cause instanceof ScoringException se) return se.isRetryable();
        if (cause instanceof ExtractionException ee) return ee.isRetryable();
        if (cause instanceof ParsingException pe) return pe.isRetryable();
        if (cause instanceof StorageReadException) return true;
        if (cause instanceof StorageObjectNotFoundException) return false;
        if (cause instanceof PayloadTooLargeException) return false;
        if (cause instanceof UnsupportedDocumentFormatException) return false;
        return false;
    }

    public String extractErrorCode(Throwable cause) {
        if (cause instanceof ScoringException se) return se.getErrorCode() != null ? se.getErrorCode() : "SCORING_FAILED";
        if (cause instanceof ExtractionException ee) return ee.getErrorCode() != null ? ee.getErrorCode() : "EXTRACTION_FAILED";
        if (cause instanceof ParsingException pe) return pe.getErrorCode() != null ? pe.getErrorCode() : "PARSING_FAILED";
        if (cause instanceof StorageReadException) return "STORAGE_READ_ERROR";
        if (cause instanceof StorageObjectNotFoundException) return "FILE_NOT_FOUND";
        if (cause instanceof PayloadTooLargeException) return "PAYLOAD_TOO_LARGE";
        if (cause instanceof UnsupportedDocumentFormatException) return "UNSUPPORTED_FORMAT";
        if (cause instanceof DocumentTooLongException) return "DOCUMENT_TOO_LONG";
        return "PARSING_FAILED";
    }

    public CvFailedEvent classify(CvUploadedEvent event, Throwable cause, boolean retryable) {
        String errorCode = extractErrorCode(cause);
        String messageStr = cause != null && cause.getMessage() != null ? cause.getMessage() : "Unknown error";
        String safeErrorMessage = piiRedactor.redact(messageStr);

        return CvFailedEvent.builder()
                .candidateId(event.getCandidateId())
                .applicationId(event.getApplicationId())
                .jobId(event.getJobId())
                .errorCode(errorCode)
                .errorMessage(safeErrorMessage)
                .retryable(retryable)
                .failedAt(Instant.now())
                .build();
    }
}
