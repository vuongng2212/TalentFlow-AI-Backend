package com.talent.cvparser.listener;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class CvParsedEvent {

    private String cvId;
    private String applicantId;
    private String jobId;

    private String extractionStatus;
}