package com.talentflow.cvparser.scoring;

import com.talentflow.cvparser.extractor.CandidateProfile;

/**
 * Scores a candidate's extracted profile against the job description.
 * Always returns a non-null {@link ScoringResult} — never throws.
 */
public interface CandidateScoringUseCase {

    /**
     * @param candidateProfile The extracted CV data (non-null)
     * @param jobDescription   The job requirements text (nullable — null/empty = SKIPPED)
     * @return ScoringResult — never null. Outcome depends on scoring path.
     */
    ScoringResult score(CandidateProfile candidateProfile, String jobDescription);
}
