package com.talentflow.cvparser.shared.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.io.InputStream;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ProdConfigConsistencyTest {

    // From base resilience4j.retry.instances.geminiApi (application.yml)
    private static final int MAX_ATTEMPTS  = 2;
    private static final int WAIT_DURATION = 2; // seconds

    @Test
    @SuppressWarnings("unchecked")
    void prodExtractionTimeoutCoversFullRetryBudgetWithProdCallTimeout() throws Exception {
        // application-prod.yml overrides llm.timeout-seconds to 30 but omits
        // llm.extraction-timeout-seconds (falls back to 20 from base config).
        // DataExtractionUseCaseImpl.get(20s) fires BEFORE the first 30s WebClient call
        // can time out — the Resilience4j retry (max-attempts=2) never executes in prod.
        // Required: extraction-timeout-seconds >= maxAttempts × (timeout-seconds + waitDuration)
        //                                      = 2 × (30 + 2) = 64s.
        Yaml yaml = new Yaml(new SafeConstructor(new LoaderOptions())); // SafeConstructor prevents !! type coercion
        ClassPathResource prod = new ClassPathResource("application-prod.yml");

        Map<String, Object> prodConfig;
        try (InputStream is = prod.getInputStream()) {
            prodConfig = yaml.load(is);
        }

        Map<String, Object> llm = (Map<String, Object>) prodConfig.get("llm");
        assertThat(llm).as("prod config must have an llm section").isNotNull();

        int prodCallTimeout = (Integer) llm.getOrDefault("timeout-seconds", 8);
        if (prodCallTimeout <= 8) {
            return; // prod uses base default (8s); base extraction-timeout (20s) already sufficient
        }

        // Prod overrides timeout-seconds > 8; extraction-timeout must be set and sufficient.
        int required = MAX_ATTEMPTS * (prodCallTimeout + WAIT_DURATION);

        Object rawExtraction = llm.get("extraction-timeout-seconds");
        assertThat(rawExtraction)
                .as("prod config overrides llm.timeout-seconds=%ds but omits " +
                    "llm.extraction-timeout-seconds. The outer guard will fire at base-default 20s, " +
                    "before the first %ds call completes — retry never runs. Set extraction-timeout-seconds >= %ds.",
                    prodCallTimeout, prodCallTimeout, required)
                .isNotNull();

        int extractionTimeout = resolveIntValue(rawExtraction);
        assertThat(extractionTimeout)
                .as("prod extraction-timeout-seconds must cover full retry budget: " +
                    "maxAttempts(%d) × (callTimeout(%d) + waitDuration(%d)) = %ds",
                    MAX_ATTEMPTS, prodCallTimeout, WAIT_DURATION, required)
                .isGreaterThanOrEqualTo(required);
    }

    // SnakeYAML returns plain integers as Integer but Spring placeholders (${VAR:default})
    // as String. Extract the numeric value from either form.
    private static int resolveIntValue(Object value) {
        if (value instanceof Integer i) return i;
        String s = value.toString().trim();
        if (s.startsWith("${") && s.contains(":")) {
            int colonIdx = s.lastIndexOf(':');
            int braceIdx = s.lastIndexOf('}');
            return Integer.parseInt(s.substring(colonIdx + 1, braceIdx).trim());
        }
        return Integer.parseInt(s);
    }
}
