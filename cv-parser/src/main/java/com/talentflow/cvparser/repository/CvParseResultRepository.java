package com.talentflow.cvparser.repository;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.scoring.ScoringResult;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import com.talentflow.cvparser.shared.dto.ParseStatus;

public interface CvParseResultRepository {

    /**
     * Save CV parse result to PostgreSQL.
     *
     * @param event   Original queue message containing candidateId, applicationId, jobId
     * @param profile Extracted CV data from LLM or regex fallback
     * @param scoring AI scoring result (may be null if scoring was not attempted)
     * @param status  The parse status to persist (derived from extraction/scoring outcome).
     *                Must reflect the real outcome (SUCCESS / PARTIAL / FAILED), not a
     *                hardcoded value, so idempotency, metrics and auditing stay accurate.
     */
    void save(CvUploadedEvent event, CandidateProfile profile, ScoringResult scoring, ParseStatus status);

    /**
     * Persist a durable FAILED (or PARTIAL) audit row when the pipeline throws before a
     * successful result can be saved. Prevents message loss and lets downstream recovery
     * read DB state. Does nothing if the application already has a SUCCESS row.
     *
     * @param event      Original queue message
     * @param status     The failure status to record (FAILED or PARTIAL)
     * @param errorMessage Redacted error message for diagnostics
     */
    void saveFailure(CvUploadedEvent event, ParseStatus status, String errorMessage);

    /**
     * Check if a successful parse result already exists for the given application ID.
     *
     * @param applicationId The application UUID
     * @return true if a row with the given status exists
     */
    boolean existsByApplicationIdAndStatus(String applicationId, ParseStatus status);
}
