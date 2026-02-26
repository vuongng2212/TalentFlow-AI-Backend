package com.talentflow.cvparser.shared.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Structured data extracted from a CV.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ParsedCvData {

    /**
     * Full name of the candidate.
     */
    private String fullName;

    /**
     * Email address.
     */
    private String email;

    /**
     * Phone number (international format preferred).
     */
    private String phone;

    /**
     * LinkedIn profile URL.
     */
    private String linkedIn;

    /**
     * List of skills extracted from the CV.
     */
    private List<String> skills;

    /**
     * Work experience entries.
     */
    private List<Experience> experience;

    /**
     * Education entries.
     */
    private List<Education> education;

    /**
     * Professional summary or objective.
     */
    private String summary;

    /**
     * Work experience entry.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Experience {
        private String title;
        private String company;
        private String startDate;   // Format: YYYY-MM
        private String endDate;     // Format: YYYY-MM or null if current
        private String description;
    }

    /**
     * Education entry.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Education {
        private String degree;
        private String institution;
        private String graduationYear;
    }
}
