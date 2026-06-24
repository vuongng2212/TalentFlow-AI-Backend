package com.talentflow.cvparser.scoring;

import com.talentflow.cvparser.shared.exception.ScoringException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link GeminiScoreResponseValidator}.
 */
class GeminiScoreResponseValidatorTest {

    private GeminiScoreResponseValidator validator;

    @BeforeEach
    void setUp() {
        validator = new GeminiScoreResponseValidator();
    }

    @Test
    void shouldAcceptValidScoreInRange() {
        assertEquals(0, validator.validate("0"));
        assertEquals(1, validator.validate("1"));
        assertEquals(50, validator.validate("50"));
        assertEquals(100, validator.validate("100"));
    }

    @Test
    void shouldRejectScoreBelowZero() {
        assertThrows(ScoringException.class, () -> validator.validate("-1"));
    }

    @Test
    void shouldRejectScoreAboveOneHundred() {
        assertThrows(ScoringException.class, () -> validator.validate("101"));
    }

    @Test
    void shouldRejectNonIntegerResponse() {
        assertThrows(ScoringException.class, () -> validator.validate("not-a-number"));
        assertThrows(ScoringException.class, () -> validator.validate("50.5"));
    }

    @Test
    void shouldRejectNullResponse() {
        assertThrows(ScoringException.class, () -> validator.validate(null));
    }

    @Test
    void shouldRejectEmptyString() {
        assertThrows(ScoringException.class, () -> validator.validate(""));
    }

    @Test
    void shouldRejectWhitespaceOnly() {
        assertThrows(ScoringException.class, () -> validator.validate("   "));
    }
}
