package com.talentflow.cvparser.extractor;

import com.talentflow.cvparser.shared.exception.ExtractionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class GeminiExtractorServiceTest {

    private GeminiLlmClient geminiLlmClient;
    private PromptBuilder promptBuilder;
    private GeminiResponseValidator responseValidator;
    private RuleBasedExtractorService ruleBasedExtractorService;
    private GeminiExtractorService extractorService;

    @BeforeEach
    void setUp() {
        geminiLlmClient = mock(GeminiLlmClient.class);
        promptBuilder = mock(PromptBuilder.class);
        responseValidator = mock(GeminiResponseValidator.class);
        ruleBasedExtractorService = mock(RuleBasedExtractorService.class);

        extractorService = new GeminiExtractorService(
                geminiLlmClient,
                promptBuilder,
                responseValidator,
                ruleBasedExtractorService
        );
    }

    @Test
    void extract_success_returnsCandidateProfile() throws Exception {
        String rawText = "some cv text";
        CvExtractionPrompt prompt = new CvExtractionPrompt("system", "user");
        CandidateProfile expectedProfile = CandidateProfile.builder()
                .fullName("Jane Doe")
                .extractionStatus(ExtractionStatus.SUCCESS)
                .build();

        when(promptBuilder.build(rawText)).thenReturn(prompt);
        when(geminiLlmClient.generate(prompt)).thenReturn(Mono.just("gemini json response"));
        when(responseValidator.validateAndParse("gemini json response")).thenReturn(expectedProfile);

        CompletableFuture<CandidateProfile> future = extractorService.extract(rawText);
        CandidateProfile result = future.get();

        assertThat(result).isSameAs(expectedProfile);
        verify(promptBuilder).build(rawText);
        verify(geminiLlmClient).generate(prompt);
        verify(responseValidator).validateAndParse("gemini json response");
        verifyNoInteractions(ruleBasedExtractorService);
    }

    @Test
    void extract_llmFails_fallsBackToRuleBased() throws Exception {
        String rawText = "some cv text";
        CvExtractionPrompt prompt = new CvExtractionPrompt("system", "user");
        ExtractionException exception = new ExtractionException("API limit exceeded", "API_ERROR", false, new RuntimeException());
        CandidateProfile fallbackProfile = CandidateProfile.builder()
                .fullName("Fallback Profile")
                .extractionStatus(ExtractionStatus.REGEX_FALLBACK)
                .build();

        when(promptBuilder.build(rawText)).thenReturn(prompt);
        when(geminiLlmClient.generate(prompt)).thenReturn(Mono.error(exception));
        when(ruleBasedExtractorService.extractSync(rawText)).thenReturn(fallbackProfile);

        CompletableFuture<CandidateProfile> future = extractorService.extract(rawText);
        CandidateProfile result = future.get();

        assertThat(result).isSameAs(fallbackProfile);
        verify(promptBuilder).build(rawText);
        verify(geminiLlmClient).generate(prompt);
        verify(ruleBasedExtractorService).extractSync(rawText);
        verifyNoInteractions(responseValidator);
    }

    @Test
    void extract_bothLlmAndFallbackFail_returnsEmptyProfile() throws Exception {
        String rawText = "some cv text";
        CvExtractionPrompt prompt = new CvExtractionPrompt("system", "user");
        RuntimeException exception = new RuntimeException("Unexpected LLM crash");

        when(promptBuilder.build(rawText)).thenReturn(prompt);
        when(geminiLlmClient.generate(prompt)).thenReturn(Mono.error(exception));
        when(ruleBasedExtractorService.extractSync(rawText)).thenThrow(new RuntimeException("Fallback crash"));

        CompletableFuture<CandidateProfile> future = extractorService.extract(rawText);
        CandidateProfile result = future.get();

        assertThat(result).isNotNull();
        assertThat(result.getSkills()).isEmpty();
        assertThat(result.getExtractionStatus()).isEqualTo(ExtractionStatus.FAILED);

        verify(promptBuilder).build(rawText);
        verify(geminiLlmClient).generate(prompt);
        verify(ruleBasedExtractorService).extractSync(rawText);
    }
}
