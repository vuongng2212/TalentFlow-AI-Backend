package com.talentflow.cvparser.shared.validation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StartupValidatorTest {

    @Mock
    private Environment environment;

    private StartupValidator startupValidator;

    @BeforeEach
    void setUp() {
        startupValidator = new StartupValidator(environment);
    }

    @Test
    void validateConfiguration_whenActiveProfileIsTest_shouldSkipValidation() {
        // Arrange
        ReflectionTestUtils.setField(startupValidator, "activeProfile", "test");

        // Act
        startupValidator.validateConfiguration();

        // Assert
        verifyNoInteractions(environment);
    }

    @Test
    void validateConfiguration_whenActiveProfileIsProdAndAllRequiredConfigsArePresent_shouldSucceed() {
        // Arrange
        ReflectionTestUtils.setField(startupValidator, "activeProfile", "prod");

        // Mock all required properties to return a non-blank value
        when(environment.getProperty("llm.api-key")).thenReturn("gemini-key");
        when(environment.getProperty("spring.datasource.url")).thenReturn("jdbc:postgresql://localhost:5432/db");
        when(environment.getProperty("spring.rabbitmq.host")).thenReturn("localhost");
        when(environment.getProperty("storage.endpoint")).thenReturn("http://localhost:9000");
        when(environment.getProperty("storage.access-key-id")).thenReturn("access");
        when(environment.getProperty("storage.secret-access-key")).thenReturn("secret");

        // Mock optional properties to cover positive path branches
        when(environment.getProperty("tesseract.data-path")).thenReturn("tessdata");

        // Act & Assert
        startupValidator.validateConfiguration(); // Should complete without throwing exceptions
    }

    @Test
    void validateConfiguration_whenActiveProfileIsProdAndRequiredConfigIsMissing_shouldThrowIllegalStateException() {
        // Arrange
        ReflectionTestUtils.setField(startupValidator, "activeProfile", "prod");

        // Mock some properties as present, but leave two required properties missing/blank
        when(environment.getProperty("llm.api-key")).thenReturn("gemini-key");
        when(environment.getProperty("spring.datasource.url")).thenReturn("jdbc:postgresql://localhost:5432/db");
        when(environment.getProperty("spring.rabbitmq.host")).thenReturn("localhost");
        when(environment.getProperty("storage.endpoint")).thenReturn(null); // Missing property
        when(environment.getProperty("storage.access-key-id")).thenReturn("   "); // Blank property
        when(environment.getProperty("storage.secret-access-key")).thenReturn("secret");

        // Act & Assert
        assertThatThrownBy(() -> startupValidator.validateConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Missing required configuration:")
                .hasMessageContaining("storage.endpoint")
                .hasMessageContaining("storage.access-key-id");
    }

    @Test
    void validateConfiguration_whenActiveProfileIsDevAndOptionalConfigsAreMissing_shouldSucceedWithWarnings() {
        // Arrange
        ReflectionTestUtils.setField(startupValidator, "activeProfile", "dev");

        // Mock optional properties to return null and empty string to exercise isBlank branches
        when(environment.getProperty("llm.api-key")).thenReturn(null);
        when(environment.getProperty("tesseract.data-path")).thenReturn("");

        // Act & Assert
        startupValidator.validateConfiguration(); // Should log warnings but not throw an exception
    }

    @Test
    void validateConfiguration_whenActiveProfileIsNull_shouldProcessOptionalAndSucceed() {
        // Arrange
        ReflectionTestUtils.setField(startupValidator, "activeProfile", null);

        // Mock optional properties to return valid values to cover the false branches of isBlank checks
        when(environment.getProperty("llm.api-key")).thenReturn("gemini-key");
        when(environment.getProperty("tesseract.data-path")).thenReturn("tessdata");

        // Act & Assert
        startupValidator.validateConfiguration(); // Should not throw an exception
    }
}
