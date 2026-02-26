package com.talentflow.cvparser.shared.validation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Startup validator that ensures required configuration is present.
 * Implements fail-fast pattern - application won't start if critical config is missing.
 */
@Component
public class StartupValidator {

    private static final Logger log = LoggerFactory.getLogger(StartupValidator.class);

    private final Environment environment;

    @Value("${spring.profiles.active:}")
    private String activeProfile;

    public StartupValidator(Environment environment) {
        this.environment = environment;
    }

    /**
     * Validate configuration after application context is ready.
     * Logs warnings for missing optional config and fails for missing required config.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void validateConfiguration() {
        log.info("Validating startup configuration for profile: {}", activeProfile);

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // Skip strict validation for test profile
        if ("test".equals(activeProfile)) {
            log.info("Test profile detected - skipping strict validation");
            return;
        }

        // Required for production
        if ("prod".equals(activeProfile)) {
            validateRequired("GEMINI_API_KEY", "llm.api-key", errors);
            validateRequired("DATABASE_URL", "spring.datasource.url", errors);
            validateRequired("RABBITMQ_HOST", "spring.rabbitmq.host", errors);
            validateRequired("R2_ENDPOINT", "storage.endpoint", errors);
            validateRequired("R2_ACCESS_KEY_ID", "storage.access-key-id", errors);
            validateRequired("R2_SECRET_ACCESS_KEY", "storage.secret-access-key", errors);
        }

        // Optional but recommended
        validateOptional("GEMINI_API_KEY", "llm.api-key", warnings, "LLM features will be disabled");
        validateOptional("TESSERACT_DATA_PATH", "tesseract.data-path", warnings, "OCR features may not work");

        // Log warnings
        for (String warning : warnings) {
            log.warn(warning);
        }

        // Fail if required config is missing in production
        if (!errors.isEmpty()) {
            String errorMessage = "Missing required configuration:\n" + String.join("\n", errors);
            log.error(errorMessage);
            throw new IllegalStateException(errorMessage);
        }

        log.info("Startup validation completed successfully");
    }

    private void validateRequired(String envVar, String property, List<String> errors) {
        String envValue = System.getenv(envVar);
        String propValue = environment.getProperty(property);

        if (isBlank(envValue) && isBlank(propValue)) {
            errors.add(String.format("  - %s (env) or %s (property) is required", envVar, property));
        }
    }

    private void validateOptional(String envVar, String property, List<String> warnings, String consequence) {
        String envValue = System.getenv(envVar);
        String propValue = environment.getProperty(property);

        if (isBlank(envValue) && isBlank(propValue)) {
            warnings.add(String.format("Optional config missing: %s / %s - %s", envVar, property, consequence));
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
