package com.talentflow.cvparser.extractor;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandidateProfile {

    private String fullName;
    private String email;
    private String phone;
    private List<String> skills;
    private Integer yearsOfExperience;

    /**
     * Trạng thái extraction: SUCCESS / PARTIAL / REGEX_FALLBACK
     */
    private String extractionStatus;
}
