package com.talentflow.cvparser.repository;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.scoring.ScoringResult;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;

public interface CvParseResultRepository {

    /**
     * Save CV parse result to PostgreSQL.
     *
     * @param event   Original queue message containing candidateId, applicationId, jobId
     * @param profile Extracted CV data from LLM or regex fallback
     * @param scoring AI scoring result (may be null if scoring was not attempted)
     */
    void save(CvUploadedEvent event, CandidateProfile profile, ScoringResult scoring);

    /**
     * Check if a successful parse result already exists for the given application ID.
     *
     * @param applicationId The application UUID
     * @return true if a row with SUCCESS status exists
     */
    boolean existsByApplicationIdAndStatus(String applicationId, com.talentflow.cvparser.shared.dto.ParseStatus status);
}
