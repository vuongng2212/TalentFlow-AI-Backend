package com.talentflow.cvparser.extractor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.talentflow.cvparser.shared.exception.ExtractionException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Validates the raw JSON string returned by Gemini against cv-extraction-schema.json,
 * then deserializes the validated JSON into a {@link CandidateProfile}.
 *
 * Used by task 3.7 DataExtractionUseCase between the LLM call and the domain mapping.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GeminiResponseValidator {

    private static final String SCHEMA_CLASSPATH = "cv-extraction-schema.json";

    private final ObjectMapper objectMapper;

    private JsonSchema jsonSchema;

    @PostConstruct
    void init() throws IOException {
        JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
        SchemaValidatorsConfig config = new SchemaValidatorsConfig();
        config.setFormatAssertionsEnabled(true);
        try (InputStream is = new ClassPathResource(SCHEMA_CLASSPATH).getInputStream()) {
            this.jsonSchema = factory.getSchema(is, config);
        }
        log.info("[SCHEMA-VALIDATOR] Schema loaded from classpath:{}", SCHEMA_CLASSPATH);
    }

    /**
     * Validate {@code rawJson} against the CV extraction JSON schema and parse it into a
     * {@link CandidateProfile} with status {@link ExtractionStatus#SUCCESS}.
     *
     * @param rawJson Raw text from Gemini — may contain accidental markdown fences.
     * @return Validated and fully-populated {@link CandidateProfile}.
     * @throws ExtractionException if the JSON is malformed or fails schema validation.
     */
    public CandidateProfile validateAndParse(String rawJson) {
        String json = stripMarkdownFences(rawJson);

        JsonNode node = parseJson(json);
        validateSchema(node);
        return toProfile(deserialize(node));
    }


    private String stripMarkdownFences(String text) {
        String stripped = text.trim();
        if (stripped.startsWith("```")) {
            int firstNewline = stripped.indexOf('\n');
            if (firstNewline != -1) stripped = stripped.substring(firstNewline + 1);
            if (stripped.endsWith("```")) stripped = stripped.substring(0, stripped.length() - 3);
            stripped = stripped.trim();
        }
        return stripped;
    }

    private JsonNode parseJson(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (IOException e) {
            throw new ExtractionException(
                    "Gemini response is not valid JSON: " + e.getMessage(),
                    "INVALID_JSON", false, e);
        }
    }

    private void validateSchema(JsonNode node) {
        Set<ValidationMessage> errors = jsonSchema.validate(node);
        if (!errors.isEmpty()) {
            String details = errors.stream()
                    .map(ValidationMessage::getMessage)
                    .collect(Collectors.joining("; "));
            log.warn("[SCHEMA-VALIDATOR] Validation failed. errors={}", details);
            throw new ExtractionException(
                    "Gemini response failed schema validation: " + details,
                    "SCHEMA_VALIDATION_FAILED", false);
        }
    }

    private GeminiExtractionResult deserialize(JsonNode node) {
        try {
            return objectMapper.treeToValue(node, GeminiExtractionResult.class);
        } catch (IOException e) {
            throw new ExtractionException(
                    "Failed to deserialize validated Gemini response: " + e.getMessage(),
                    "DESERIALIZATION_FAILED", false, e);
        }
    }

    private CandidateProfile toProfile(GeminiExtractionResult r) {
        return CandidateProfile.builder()
                .fullName(r.fullName())
                .email(r.email())
                .phone(r.phone())
                .linkedIn(r.linkedIn())
                .summary(r.summary())
                .yearsOfExperience(r.yearsOfExperience())
                .skills(r.skills() != null ? r.skills() : List.of())
                .experience(mapExperience(r.experience()))
                .education(mapEducation(r.education()))
                .extractionStatus(deriveStatus(r))
                .build();
    }

    /**
     * SUCCESS only when both key identifiers (fullName and email) are present.
     * Otherwise PARTIAL — Gemini ran cleanly but the result is too thin to be trusted.
     */
    private ExtractionStatus deriveStatus(GeminiExtractionResult r) {
        boolean hasName = r.fullName() != null && !r.fullName().isBlank();
        boolean hasEmail = r.email() != null && !r.email().isBlank();
        return (hasName && hasEmail) ? ExtractionStatus.SUCCESS : ExtractionStatus.PARTIAL;
    }

    private List<CandidateProfile.WorkExperience> mapExperience(List<GeminiExtractionResult.ExperienceEntry> src) {
        if (src == null) return List.of();
        return src.stream()
                .map(e -> CandidateProfile.WorkExperience.builder()
                        .title(e.title())
                        .company(e.company())
                        .startDate(e.startDate())
                        .endDate(e.endDate())
                        .description(e.description())
                        .build())
                .toList();
    }

    private List<CandidateProfile.EducationEntry> mapEducation(List<GeminiExtractionResult.EducationEntry> src) {
        if (src == null) return List.of();
        return src.stream()
                .map(e -> CandidateProfile.EducationEntry.builder()
                        .degree(e.degree())
                        .institution(e.institution())
                        .graduationYear(e.graduationYear())
                        .build())
                .toList();
    }


    record GeminiExtractionResult(
            String fullName,
            String email,
            String phone,
            String linkedIn,
            String summary,
            Integer yearsOfExperience,
            List<String> skills,
            List<ExperienceEntry> experience,
            List<EducationEntry> education
    ) {
        record ExperienceEntry(
                String title,
                String company,
                String startDate,
                String endDate,
                String description
        ) {}

        record EducationEntry(
                String degree,
                String institution,
                String graduationYear
        ) {}
    }
}
