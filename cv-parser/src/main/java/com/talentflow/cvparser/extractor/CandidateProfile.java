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
    private String linkedIn;
    private String summary;
    private List<String> skills;
    private Integer yearsOfExperience;
    private List<WorkExperience> experience;
    private List<EducationEntry> education;
    private ExtractionStatus extractionStatus;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkExperience {
        private String title;
        private String company;
        /** Format: YYYY-MM */
        private String startDate;
        /** Format: YYYY-MM, or null if current role */
        private String endDate;
        private String description;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EducationEntry {
        private String degree;
        private String institution;
        private String graduationYear;
    }
}
