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
 * Rule-based CV extractor using regex patterns.
 * Extracts email, phone, LinkedIn URL, and skill keywords.
 *
 * Used as the fallback when Gemini LLM is unavailable (task 3.6).
 */
@Slf4j
@Service
public class RuleBasedExtractorService implements CvExtractorService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}",
            Pattern.CASE_INSENSITIVE
    );

    // Matches Vietnamese (0xx, +84) and international formats
    private static final Pattern PHONE_PATTERN = Pattern.compile(
            "(?:\\+?84|0)(?:[\\s\\-.]?\\d){8,9}|" +
            "(?:\\+?\\d{1,3}[\\s\\-.]?)?\\(?\\d{2,4}\\)?[\\s\\-.]?\\d{3,4}[\\s\\-.]?\\d{3,4}"
    );

    private static final Pattern LINKEDIN_PATTERN = Pattern.compile(
            "(?:https?://)?(?:www\\.)?linkedin\\.com/in/([a-zA-Z0-9\\-_.%]+)/?",
            Pattern.CASE_INSENSITIVE
    );

    private static final List<String> KNOWN_SKILLS = List.of(
            "Java", "Python", "JavaScript", "TypeScript", "Go", "Kotlin", "Scala",
            "Spring", "Spring Boot", "Spring Security", "Hibernate",
            "React", "Angular", "Vue", "Node.js", "NestJS", "Express",
            "Docker", "Kubernetes", "Terraform", "Ansible",
            "AWS", "GCP", "Azure",
            "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
            "RabbitMQ", "Kafka",
            "Git", "CI/CD", "Jenkins", "GitHub Actions",
            "REST", "GraphQL", "gRPC",
            "Linux", "Bash", "Maven", "Gradle"
    );

    @Override
    @Async("llmExecutor")
    public CompletableFuture<CandidateProfile> extract(String rawText) {
        return CompletableFuture.completedFuture(extractSync(rawText));
    }

    /**
     * Synchronous extraction — called directly by {@link GeminiExtractorService}
     * in its fallback path (already running inside llmExecutor, no re-scheduling needed).
     */
    public CandidateProfile extractSync(String rawText) {
        log.info("[RULE-EXTRACTOR] Extracting from {} chars", rawText.length());

        String email = extractFirst(EMAIL_PATTERN, rawText);
        String phone = extractFirst(PHONE_PATTERN, rawText);
        String linkedIn = extractLinkedIn(rawText);
        List<String> skills = extractSkills(rawText);

        // Status reflects the mechanism used (rule-based), not what was found.
        // Completeness is conveyed via the populated fields themselves.
        CandidateProfile profile = CandidateProfile.builder()
                .email(email)
                .phone(phone)
                .linkedIn(linkedIn)
                .skills(skills)
                .extractionStatus(ExtractionStatus.REGEX_FALLBACK)
                .build();

        log.info("[RULE-EXTRACTOR] Done. email={}, phone={}, linkedIn={}, skills={}",
                email    != null ? "[found]" : "[not found]",
                phone    != null ? "[found]" : "[not found]",
                linkedIn != null ? "[found]" : "[not found]",
                skills.size());

        return profile;
    }

    private String extractFirst(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? matcher.group().trim() : null;
    }

    private String extractLinkedIn(String text) {
        Matcher matcher = LINKEDIN_PATTERN.matcher(text);
        if (!matcher.find()) return null;
        // Return canonical URL form regardless of whether the input had protocol/www
        return "https://linkedin.com/in/" + matcher.group(1);
    }

    private List<String> extractSkills(String text) {
        List<String> found = new ArrayList<>();
        String lower = text.toLowerCase();
        for (String skill : KNOWN_SKILLS) {
            if (lower.contains(skill.toLowerCase())) {
                found.add(skill);
            }
        }
        return found;
    }
}
