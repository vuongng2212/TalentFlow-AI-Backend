package com.talent.cvparser.extractor;

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

    private String extractionStatus;
}