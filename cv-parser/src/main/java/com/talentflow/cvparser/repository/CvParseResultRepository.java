package com.talentflow.cvparser.repository;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.shared.dto.CvUploadedEvent;

public interface CvParseResultRepository {

    /**
     * Lưu kết quả parse vào PostgreSQL.
     * Implement bởi JPA sau khi có Flyway schema.
     *
     * @param event   Message gốc từ queue — chứa candidateId, applicationId, jobId
     * @param profile Kết quả extract từ LLM hoặc Regex fallback
     */
    void save(CvUploadedEvent event, CandidateProfile profile);
}
