package com.talentflow.cvparser.extractor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Regex-based CV extractor — fallback implementation for phase 2.
 * Extracts basic fields (email, phone, name) using pattern matching.
 *
 * Will be replaced by GeminiExtractorService in phase 3.
 */
@Slf4j
@Service
public class RegexExtractorService implements CvExtractorService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern PHONE_PATTERN = Pattern.compile(
            "(\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{2,4}\\)?[-.\\s]?\\d{3,4}[-.\\s]?\\d{3,4}"
    );

    // Simple skill keywords to scan for
    private static final List<String> KNOWN_SKILLS = List.of(
            "Java", "Python", "JavaScript", "TypeScript", "Spring", "Spring Boot",
            "React", "Angular", "Vue", "Node.js", "Docker", "Kubernetes",
            "AWS", "GCP", "Azure", "PostgreSQL", "MySQL", "MongoDB",
            "Redis", "RabbitMQ", "Kafka", "Git", "CI/CD", "REST", "GraphQL"
    );

    @Override
    @Async("llmExecutor")
    public CompletableFuture<CandidateProfile> extract(String rawText) {
        log.info("[REGEX-EXTRACTOR] Extracting from {} chars of raw text", rawText.length());

        String email = extractFirst(EMAIL_PATTERN, rawText);
        String phone = extractFirst(PHONE_PATTERN, rawText);
        List<String> skills = extractSkills(rawText);

        CandidateProfile profile = CandidateProfile.builder()
                .email(email)
                .phone(phone)
                .skills(skills)
                .extractionStatus(email != null ? "PARTIAL" : "REGEX_FALLBACK")
                .build();

        log.info("[REGEX-EXTRACTOR] Done. email={}, phone={}, skills={}",
                email != null ? "[found]" : "[not found]",
                phone != null ? "[found]" : "[not found]",
                skills.size());

        return CompletableFuture.completedFuture(profile);
    }

    private String extractFirst(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher.group().trim() : null;
    }

    private List<String> extractSkills(String text) {
        List<String> found = new ArrayList<>();
        String lowerText = text.toLowerCase();
        for (String skill : KNOWN_SKILLS) {
            if (lowerText.contains(skill.toLowerCase())) {
                found.add(skill);
            }
        }
        return found;
    }
}
