package com.talentflow.cvparser.scoring;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.shared.config.ScoringConfig;
import com.talentflow.cvparser.shared.dto.ScoringStatus;
import com.talentflow.cvparser.shared.exception.ScoringException;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link CandidateScoringService}.
 */
@ExtendWith(MockitoExtension.class)
class CandidateScoringServiceTest {

    @Mock
    private GeminiScoringClient scoringClient;

    @Mock
    private GeminiScoreResponseValidator validator;

    private ScoringConfig scoringConfig;
    private MeterRegistry meterRegistry;
    private CandidateScoringService scoringService;

    private CandidateProfile validProfile;
    private String jobDescription;

    @BeforeEach
    void setUp() {
        scoringConfig = new ScoringConfig();
        meterRegistry = new SimpleMeterRegistry();
        scoringService = new CandidateScoringService(scoringClient, validator, scoringConfig, meterRegistry);
        validProfile = CandidateProfile.builder()
                .fullName("Nguyen Van A")
                .email("a@example.com")
                .build();
        jobDescription = "Looking for a Senior Engineer with 5+ years experience";
    }

    @Test
    void shouldReturnSuccessScoreOnValidResponse() {
        when(scoringClient.callScoringApi(any(), any())).thenReturn(Mono.just("85"));
        when(validator.validate("85")).thenReturn(85);

        ScoringResult result = scoringService.score(validProfile, jobDescription);

        assertEquals(85, result.getAiScore());
        assertNotNull(result.getScoringReasoning());
        assertEquals(ScoringStatus.SUCCESS, result.getScoringStatus());
    }

    @Test
    void shouldTriggerFallbackWhenGeminiExceptionOccurs() {
        when(scoringClient.callScoringApi(any(), any()))
                .thenReturn(Mono.error(new RuntimeException("API error")));

        ScoringResult result = scoringService.score(validProfile, jobDescription);

        assertEquals(50, result.getAiScore());
        assertEquals("Scoring unavailable", result.getScoringReasoning());
        assertEquals(ScoringStatus.FALLBACK, result.getScoringStatus());
    }

    @Test
    void shouldTriggerFallbackWhenScoreOutOfRange() {
        when(scoringClient.callScoringApi(any(), any())).thenReturn(Mono.just("150"));
        when(validator.validate("150")).thenThrow(new ScoringException("Score must be between 0 and 100", "SCORE_OUT_OF_RANGE", false));

        ScoringResult result = scoringService.score(validProfile, jobDescription);

        assertEquals(50, result.getAiScore());
        assertEquals("Scoring unavailable", result.getScoringReasoning());
        assertEquals(ScoringStatus.FALLBACK, result.getScoringStatus());
    }

    @Test
    void shouldReturnSkippedWhenJobDescriptionIsEmpty() {
        ScoringResult result = scoringService.score(validProfile, "");

        assertEquals(0, result.getAiScore());
        assertNull(result.getScoringReasoning());
        assertEquals(ScoringStatus.SKIPPED, result.getScoringStatus());
    }

    @Test
    void shouldReturnSkippedWhenJobDescriptionIsNull() {
        ScoringResult result = scoringService.score(validProfile, null);

        assertEquals(0, result.getAiScore());
        assertNull(result.getScoringReasoning());
        assertEquals(ScoringStatus.SKIPPED, result.getScoringStatus());
    }

    @Test
    void shouldNeverThrowException() {
        when(scoringClient.callScoringApi(any(), any()))
                .thenReturn(Mono.error(new RuntimeException("Unexpected error")));

        assertDoesNotThrow(() -> scoringService.score(validProfile, jobDescription));
    }
}
