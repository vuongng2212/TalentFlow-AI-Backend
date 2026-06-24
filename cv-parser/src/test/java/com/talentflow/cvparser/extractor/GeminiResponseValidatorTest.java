package com.talentflow.cvparser.extractor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talentflow.cvparser.shared.exception.ExtractionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GeminiResponseValidatorTest {

    private GeminiResponseValidator validator;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() throws IOException {
        objectMapper = new ObjectMapper();
        validator = new GeminiResponseValidator(objectMapper);
        validator.init();
    }

    @Test
    void validateAndParse_withValidJson_shouldReturnSuccessProfile() {
        String validJson = """
            {
              "fullName": "Jane Doe",
              "email": "jane.doe@example.com",
              "phone": "+123456789",
              "linkedIn": "https://linkedin.com/in/janedoe",
              "summary": "Experienced software engineer",
              "yearsOfExperience": 5,
              "skills": ["Java", "Spring Boot", "SQL"],
              "experience": [
                {
                  "title": "Senior Engineer",
                  "company": "Tech Corp",
                  "startDate": "2020-01",
                  "endDate": "2023-12",
                  "description": "Led backend development"
                }
              ],
              "education": [
                {
                  "degree": "B.S. Computer Science",
                  "institution": "State University",
                  "graduationYear": "2019"
                }
              ]
            }
            """;

        CandidateProfile profile = validator.validateAndParse(validJson);

        assertThat(profile).isNotNull();
        assertThat(profile.getFullName()).isEqualTo("Jane Doe");
        assertThat(profile.getEmail()).isEqualTo("jane.doe@example.com");
        assertThat(profile.getPhone()).isEqualTo("+123456789");
        assertThat(profile.getLinkedIn()).isEqualTo("https://linkedin.com/in/janedoe");
        assertThat(profile.getSummary()).isEqualTo("Experienced software engineer");
        assertThat(profile.getYearsOfExperience()).isEqualTo(5);
        assertThat(profile.getSkills()).containsExactly("Java", "Spring Boot", "SQL");
        assertThat(profile.getExtractionStatus()).isEqualTo(ExtractionStatus.SUCCESS);

        assertThat(profile.getExperience()).hasSize(1);
        CandidateProfile.WorkExperience exp = profile.getExperience().get(0);
        assertThat(exp.getTitle()).isEqualTo("Senior Engineer");
        assertThat(exp.getCompany()).isEqualTo("Tech Corp");
        assertThat(exp.getStartDate()).isEqualTo("2020-01");
        assertThat(exp.getEndDate()).isEqualTo("2023-12");
        assertThat(exp.getDescription()).isEqualTo("Led backend development");

        assertThat(profile.getEducation()).hasSize(1);
        CandidateProfile.EducationEntry edu = profile.getEducation().get(0);
        assertThat(edu.getDegree()).isEqualTo("B.S. Computer Science");
        assertThat(edu.getInstitution()).isEqualTo("State University");
        assertThat(edu.getGraduationYear()).isEqualTo("2019");
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"fullName\": \"Jane Doe\", \"skills\": [\"Java\"]}",
        "{\"email\": \"jane.doe@example.com\", \"skills\": [\"Java\"]}",
        "{\"fullName\": \"   \", \"email\": \"jane.doe@example.com\", \"skills\": [\"Java\"]}",
        "{\"fullName\": null, \"email\": null, \"skills\": [\"Java\"]}"
    })
    void validateAndParse_whenIdentifiersMissingOrBlank_shouldReturnPartialProfile(String json) {
        CandidateProfile profile = validator.validateAndParse(json);
        assertThat(profile.getExtractionStatus()).isEqualTo(ExtractionStatus.PARTIAL);
    }

    @Test
    void validateAndParse_withMarkdownFences_shouldStripFencesAndParse() {
        String fencedJson = """
            ```json
            {
              "fullName": "Jane Doe",
              "email": "jane.doe@example.com",
              "skills": ["Java"]
            }
            ```
            """;

        CandidateProfile profile = validator.validateAndParse(fencedJson);
        assertThat(profile.getFullName()).isEqualTo("Jane Doe");
        assertThat(profile.getExtractionStatus()).isEqualTo(ExtractionStatus.SUCCESS);
    }

    @Test
    void validateAndParse_withMalformedJson_shouldThrowInvalidJsonException() {
        String malformedJson = "{ fullName: \"Jane Doe\", }";

        assertThatThrownBy(() -> validator.validateAndParse(malformedJson))
                .isInstanceOf(ExtractionException.class)
                .hasMessageContaining("Gemini response is not valid JSON")
                .extracting(e -> ((ExtractionException) e).getErrorCode())
                .isEqualTo("INVALID_JSON");
    }

    @Test
    void validateAndParse_whenSchemaValidationFails_shouldThrowSchemaValidationException() {
        // Missing required field "skills"
        String invalidJson = "{\"fullName\": \"Jane Doe\", \"email\": \"jane.doe@example.com\"}";

        assertThatThrownBy(() -> validator.validateAndParse(invalidJson))
                .isInstanceOf(ExtractionException.class)
                .hasMessageContaining("failed schema validation")
                .extracting(e -> ((ExtractionException) e).getErrorCode())
                .isEqualTo("SCHEMA_VALIDATION_FAILED");
    }

    @Test
    void validateAndParse_whenAdditionalPropertyAdded_shouldThrowSchemaValidationException() {
        String invalidJson = "{\"fullName\": \"Jane Doe\", \"skills\": [\"Java\"], \"extraField\": \"not allowed\"}";

        assertThatThrownBy(() -> validator.validateAndParse(invalidJson))
                .isInstanceOf(ExtractionException.class)
                .hasMessageContaining("extraField")
                .extracting(e -> ((ExtractionException) e).getErrorCode())
                .isEqualTo("SCHEMA_VALIDATION_FAILED");
    }

    @Test
    void validateAndParse_whenInvalidEmailFormat_shouldThrowSchemaValidationException() {
        String invalidJson = "{\"fullName\": \"Jane Doe\", \"email\": \"invalid-email\", \"skills\": [\"Java\"]}";

        assertThatThrownBy(() -> validator.validateAndParse(invalidJson))
                .isInstanceOf(ExtractionException.class)
                .hasMessageContaining("email")
                .extracting(e -> ((ExtractionException) e).getErrorCode())
                .isEqualTo("SCHEMA_VALIDATION_FAILED");
    }

    @Test
    void validateAndParse_whenInvalidDateFormat_shouldThrowSchemaValidationException() {
        // Date must match YYYY-MM
        String invalidJson = """
            {
              "skills": ["Java"],
              "experience": [
                {
                  "title": "Developer",
                  "company": "Acme",
                  "startDate": "20-01-01"
                }
              ]
            }
            """;

        assertThatThrownBy(() -> validator.validateAndParse(invalidJson))
                .isInstanceOf(ExtractionException.class)
                .hasMessageContaining("startDate")
                .extracting(e -> ((ExtractionException) e).getErrorCode())
                .isEqualTo("SCHEMA_VALIDATION_FAILED");
    }

    @Test
    void validateAndParse_whenNullLists_shouldReturnEmptyListsInProfile() {
        String json = "{\"fullName\": \"Jane Doe\", \"email\": \"jane.doe@example.com\", \"skills\": []}";

        CandidateProfile profile = validator.validateAndParse(json);
        assertThat(profile.getSkills()).isEmpty();
        assertThat(profile.getExperience()).isEmpty();
        assertThat(profile.getEducation()).isEmpty();
    }
}
