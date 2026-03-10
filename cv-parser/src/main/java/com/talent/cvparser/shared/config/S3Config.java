package com.talent.cvparser.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
@ConfigurationProperties(prefix = "app.storage")
@Getter
@Setter
public class S3Config {

    private String endpoint;
    private String accessKey;
    private String secretKey;
    private String region;
    private String bucket;

}
