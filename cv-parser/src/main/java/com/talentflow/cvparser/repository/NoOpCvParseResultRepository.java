package com.talentflow.cvparser.repository;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

/**
 * No-op repository — placeholder for phase 2.
 * Logs the result but does not persist to DB.
 *
 * Will be replaced by JpaCV ParseResultRepository with Flyway schema in phase 3.
 */
@Slf4j
@Repository
public class NoOpCvParseResultRepository implements CvParseResultRepository {

    @Override
    public void save(CvUploadedEvent event, CandidateProfile profile) {
        log.warn("[NO-OP-REPO] Persistence not implemented yet. " +
                        "candidateId={}, applicationId={}, status={}",
                event.getCandidateId(),
                event.getApplicationId(),
                profile.getExtractionStatus());
    }
}
