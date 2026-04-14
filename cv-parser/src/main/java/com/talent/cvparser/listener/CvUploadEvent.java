package com.talent.cvparser.listener;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CvUploadEvent {

    private String cvId;
    private String objectKey;
    private String applicantId;
    private String jobId;
}