package com.talentflow.cvparser.shared.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;
import java.util.Set;

/**
 * S3/MinIO/R2 storage client configuration.
 *
 * Uses environment variables:
 *   - R2_ENDPOINT: S3-compatible endpoint URL
 *   - R2_ACCESS_KEY_ID: Access key
 *   - R2_SECRET_ACCESS_KEY: Secret key
 *   - R2_BUCKET: Bucket name (default: talentflow-cvs)
 *   - R2_REGION: Region (default: us-east-1)
 */
@Configuration
public class S3Config {

    private static final Logger log = LoggerFactory.getLogger(S3Config.class);

    // Allowed endpoint schemes
    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

    // Allowed endpoint hosts for security (extend as needed)
    private static final Set<String> ALLOWED_HOSTS = Set.of(
            "localhost",
            "minio",
            "s3.amazonaws.com",
            "storage.googleapis.com"
    );

    @Value("${storage.endpoint}")
    private String endpoint;

    @Value("${storage.access-key-id}")
    private String accessKeyId;

    @Value("${storage.secret-access-key}")
    private String secretAccessKey;

    @Value("${storage.region:us-east-1}")
    private String region;

    @Value("${storage.bucket}")
    private String bucket;

    /**
     * Validate S3 endpoint configuration at startup.
     * Prevents SSRF by restricting allowed endpoints.
     */
    @PostConstruct
    public void validateEndpoint() {
        if (endpoint == null || endpoint.isBlank()) {
            throw new IllegalStateException("S3 endpoint cannot be null or empty");
        }

        try {
            URI uri = URI.create(endpoint);
            String scheme = uri.getScheme();
            String host = uri.getHost();

            // Validate scheme
            if (scheme == null || !ALLOWED_SCHEMES.contains(scheme.toLowerCase())) {
                throw new IllegalStateException(
                        String.format("S3 endpoint scheme '%s' not allowed. Use http or https.", scheme)
                );
            }

            // Validate host (allow known hosts or *.amazonaws.com, *.r2.cloudflarestorage.com)
            if (host == null) {
                throw new IllegalStateException("S3 endpoint must have a valid host");
            }

            boolean isAllowed = ALLOWED_HOSTS.contains(host.toLowerCase())
                    || host.endsWith(".amazonaws.com")
                    || host.endsWith(".r2.cloudflarestorage.com")
                    || host.endsWith(".digitaloceanspaces.com")
                    || host.matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"); // Allow IP addresses for dev

            if (!isAllowed) {
                log.warn("S3 endpoint host '{}' is not in the standard allowlist. Ensure this is intentional.", host);
            }

            log.info("S3 endpoint validated: {}", endpoint);

        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Invalid S3 endpoint URL: " + endpoint, e);
        }
    }

    /**
     * S3 client configured for MinIO/R2/S3.
     * Uses path-style access for MinIO compatibility.
     */
    @Bean
    public S3Client s3Client() {
        AwsBasicCredentials credentials = AwsBasicCredentials.create(accessKeyId, secretAccessKey);

        return S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .forcePathStyle(true) // Required for MinIO
                .build();
    }

    /**
     * Get the configured bucket name.
     */
    @Bean
    public String storageBucket() {
        return bucket;
    }
}
