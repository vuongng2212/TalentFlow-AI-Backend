package com.talent.cvparser.repository;

import com.talent.cvparser.extractor.CandidateProfile;
import com.talent.cvparser.listener.CvUploadEvent;

public interface CvParseResultRepository {

    /**
     * Lưu kết quả parse vào PostgreSQL.
     * Implement bởi JPA/MyBatis sau khi có Flyway schema (CVP-018).
     *
     * @param event   Message gốc từ queue — chứa cvId, applicantId, jobId
     * @param profile Kết quả extract từ LLM hoặc Regex fallback
     */
    void save(CvUploadEvent event, CandidateProfile profile);
}