package com.talentflow.cvparser.usecase;

import com.talentflow.cvparser.extractor.CandidateProfile;
import com.talentflow.cvparser.extractor.CvExtractorService;
import com.talentflow.cvparser.extractor.ExtractionStatus;
import com.talentflow.cvparser.extractor.RuleBasedExtractorService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Field;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class DataExtractionUseCaseImplTest {

    @Test
    void outerExtractionTimeoutUsesDecoupledConfigKeyToAllowRetries() throws NoSuchFieldException {
        // When the outer .get(timeout) guard reads the same key as the per-call WebClient timeout
        // (llm.timeout-seconds=8), both fire simultaneously on the first call failure —
        // the Resilience4j retry (max-attempts=2) never executes, wasting the retry budget.
        // Fix: outer guard reads llm.extraction-timeout-seconds, sized to cover the full retry
        // budget: maxAttempts × (perCallTimeout + waitDuration) = 2 × (8 + 2) = 20s.
        Field field = DataExtractionUseCaseImpl.class.getDeclaredField("timeoutSeconds");
        Value annotation = field.getAnnotation(Value.class);

        assertThat(annotation.value())
                .as("DataExtractionUseCaseImpl outer timeout must read llm.extraction-timeout-seconds, " +
                    "not llm.timeout-seconds — same key causes the outer guard to fire simultaneously " +
                    "with the per-call WebClient timeout, preventing retries from executing")
                .contains("llm.extraction-timeout-seconds")
                .doesNotContain("llm.timeout-seconds");
    }

    @Test
    void extractWithNullTextReturnsEmptyProfile() {
        CvExtractorService cvExtractorService = mock(CvExtractorService.class);
        RuleBasedExtractorService ruleBasedExtractorService = mock(RuleBasedExtractorService.class);

        DataExtractionUseCaseImpl useCase = new DataExtractionUseCaseImpl(cvExtractorService, ruleBasedExtractorService);

        CandidateProfile profile = useCase.extract(null);

        assertThat(profile).isNotNull();
        assertThat(profile.getSkills()).isEmpty();
        assertThat(profile.getExtractionStatus()).isEqualTo(ExtractionStatus.FAILED);

        verifyNoInteractions(cvExtractorService);
        verifyNoInteractions(ruleBasedExtractorService);
    }

    @Test
    void extractWithShortTextCallsRuleBasedExtractor() {
        CvExtractorService cvExtractorService = mock(CvExtractorService.class);
        RuleBasedExtractorService ruleBasedExtractorService = mock(RuleBasedExtractorService.class);
        CandidateProfile expectedProfile = CandidateProfile.builder()
                .fullName("Short Text Profile")
                .extractionStatus(ExtractionStatus.REGEX_FALLBACK)
                .build();

        when(ruleBasedExtractorService.extractSync("short text")).thenReturn(expectedProfile);

        DataExtractionUseCaseImpl useCase = new DataExtractionUseCaseImpl(cvExtractorService, ruleBasedExtractorService);
        ReflectionTestUtils.setField(useCase, "minLlmTextLength", 50);

        CandidateProfile profile = useCase.extract("short text");

        assertThat(profile).isSameAs(expectedProfile);
        verify(ruleBasedExtractorService).extractSync("short text");
        verifyNoInteractions(cvExtractorService);
    }

    @Test
    void extractWithLongTextSuccessfulLlmExtraction() {
        CvExtractorService cvExtractorService = mock(CvExtractorService.class);
        RuleBasedExtractorService ruleBasedExtractorService = mock(RuleBasedExtractorService.class);
        CandidateProfile expectedProfile = CandidateProfile.builder()
                .fullName("John Doe")
                .extractionStatus(ExtractionStatus.SUCCESS)
                .build();

        CompletableFuture<CandidateProfile> future = CompletableFuture.completedFuture(expectedProfile);
        String rawText = "This is a sufficiently long raw text that is parsed from a CV document.";
        when(cvExtractorService.extract(rawText)).thenReturn(future);

        DataExtractionUseCaseImpl useCase = new DataExtractionUseCaseImpl(cvExtractorService, ruleBasedExtractorService);
        ReflectionTestUtils.setField(useCase, "minLlmTextLength", 50);
        ReflectionTestUtils.setField(useCase, "timeoutSeconds", 20L);

        CandidateProfile profile = useCase.extract(rawText);

        assertThat(profile).isSameAs(expectedProfile);
        verify(cvExtractorService).extract(rawText);
        verifyNoInteractions(ruleBasedExtractorService);
    }

    @Test
    void extractLlmTimeoutFallsBackToRuleBased() throws Exception {
        CvExtractorService cvExtractorService = mock(CvExtractorService.class);
        RuleBasedExtractorService ruleBasedExtractorService = mock(RuleBasedExtractorService.class);

        CompletableFuture<CandidateProfile> future = mock(CompletableFuture.class);
        when(future.get(anyLong(), any(TimeUnit.class))).thenThrow(new TimeoutException("LLM timeout"));

        String rawText = "This is a sufficiently long raw text that is parsed from a CV document.";
        when(cvExtractorService.extract(rawText)).thenReturn(future);

        CandidateProfile fallbackProfile = CandidateProfile.builder()
                .fullName("Fallback Profile")
                .extractionStatus(ExtractionStatus.REGEX_FALLBACK)
                .build();
        when(ruleBasedExtractorService.extractSync(rawText)).thenReturn(fallbackProfile);

        DataExtractionUseCaseImpl useCase = new DataExtractionUseCaseImpl(cvExtractorService, ruleBasedExtractorService);
        ReflectionTestUtils.setField(useCase, "minLlmTextLength", 50);
        ReflectionTestUtils.setField(useCase, "timeoutSeconds", 20L);

        CandidateProfile profile = useCase.extract(rawText);

        assertThat(profile).isSameAs(fallbackProfile);
        verify(cvExtractorService).extract(rawText);
        verify(ruleBasedExtractorService).extractSync(rawText);
    }

    @Test
    void extractLlmFailureFallsBackToRuleBased() throws Exception {
        CvExtractorService cvExtractorService = mock(CvExtractorService.class);
        RuleBasedExtractorService ruleBasedExtractorService = mock(RuleBasedExtractorService.class);

        CompletableFuture<CandidateProfile> future = mock(CompletableFuture.class);
        when(future.get(anyLong(), any(TimeUnit.class)))
                .thenThrow(new ExecutionException("LLM failure", new RuntimeException("API error")));

        String rawText = "This is a sufficiently long raw text that is parsed from a CV document.";
        when(cvExtractorService.extract(rawText)).thenReturn(future);

        CandidateProfile fallbackProfile = CandidateProfile.builder()
                .fullName("Fallback Profile")
                .extractionStatus(ExtractionStatus.REGEX_FALLBACK)
                .build();
        when(ruleBasedExtractorService.extractSync(rawText)).thenReturn(fallbackProfile);

        DataExtractionUseCaseImpl useCase = new DataExtractionUseCaseImpl(cvExtractorService, ruleBasedExtractorService);
        ReflectionTestUtils.setField(useCase, "minLlmTextLength", 50);
        ReflectionTestUtils.setField(useCase, "timeoutSeconds", 20L);

        CandidateProfile profile = useCase.extract(rawText);

        assertThat(profile).isSameAs(fallbackProfile);
        verify(cvExtractorService).extract(rawText);
        verify(ruleBasedExtractorService).extractSync(rawText);
    }

    @Test
    void extractLlmInterruptedRestoresInterruptStatusAndFallsBackToRuleBased() throws Exception {
        CvExtractorService cvExtractorService = mock(CvExtractorService.class);
        RuleBasedExtractorService ruleBasedExtractorService = mock(RuleBasedExtractorService.class);

        CompletableFuture<CandidateProfile> future = mock(CompletableFuture.class);
        when(future.get(anyLong(), any(TimeUnit.class))).thenThrow(new InterruptedException("Interrupted"));

        String rawText = "This is a sufficiently long raw text that is parsed from a CV document.";
        when(cvExtractorService.extract(rawText)).thenReturn(future);

        CandidateProfile fallbackProfile = CandidateProfile.builder()
                .fullName("Fallback Profile")
                .extractionStatus(ExtractionStatus.REGEX_FALLBACK)
                .build();
        when(ruleBasedExtractorService.extractSync(rawText)).thenReturn(fallbackProfile);

        DataExtractionUseCaseImpl useCase = new DataExtractionUseCaseImpl(cvExtractorService, ruleBasedExtractorService);
        ReflectionTestUtils.setField(useCase, "minLlmTextLength", 50);
        ReflectionTestUtils.setField(useCase, "timeoutSeconds", 20L);

        Thread.interrupted(); // Clear thread interrupt flag if set from a previous test

        CandidateProfile profile = useCase.extract(rawText);

        assertThat(profile).isSameAs(fallbackProfile);
        assertThat(Thread.currentThread().isInterrupted()).isTrue();
        Thread.interrupted(); // Clean up thread state

        verify(cvExtractorService).extract(rawText);
        verify(ruleBasedExtractorService).extractSync(rawText);
    }
}
