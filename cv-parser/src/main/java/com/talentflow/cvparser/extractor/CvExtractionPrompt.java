package com.talentflow.cvparser.extractor;

/**
 * Holds the system instruction and user content for a Gemini extraction call.
 * Built by {@link PromptBuilder}; consumed by {@link GeminiLlmClient}.
 */
public record CvExtractionPrompt(String systemInstruction, String userContent) {}
