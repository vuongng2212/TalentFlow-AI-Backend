package com.talent.cvparser.shared.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Getter
@Setter
@Validated
@ConfigurationProperties(prefix = "app.storage")
public class S3Properties {

    @NotBlank(message = "Endpoint is required")
    private String endpoint;

    @NotBlank(message = "Access key is required")
    private String accessKey;

    @NotBlank(message = "Secret key is required")
    private String secretKey;

    @NotBlank(message = "Region is required")
    private String region;

    @NotBlank(message = "Bucket is required")
    private String bucket;

    @Positive(message = "Max file size must be a positive number of bytes")
    private long maxFileSizeBytes;

    private boolean pathStyleAccess;
}
