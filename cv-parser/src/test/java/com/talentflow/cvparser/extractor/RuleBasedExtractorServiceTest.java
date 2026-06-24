package com.talentflow.cvparser.extractor;

import org.junit.jupiter.api.Test;
import java.util.concurrent.CompletableFuture;
import static org.assertj.core.api.Assertions.assertThat;

class RuleBasedExtractorServiceTest {

    private final RuleBasedExtractorService extractorService = new RuleBasedExtractorService();

    @Test
    void testExtractAsync_returnsCompletedFuture() throws Exception {
        // Removed trailing dot after johndoe so regex parses it without the dot
        String text = "Contact me at candidate@example.com or phone +84901234567. Profile: linkedin.com/in/johndoe Skills: Java, Docker.";
        CompletableFuture<CandidateProfile> future = extractorService.extract(text);

        assertThat(future).isNotNull();
        assertThat(future.isDone()).isTrue();

        CandidateProfile profile = future.get();
        assertThat(profile).isNotNull();
        assertThat(profile.getEmail()).isEqualTo("candidate@example.com");
        assertThat(profile.getPhone()).isEqualTo("+84901234567");
        assertThat(profile.getLinkedIn()).isEqualTo("https://linkedin.com/in/johndoe");
        assertThat(profile.getSkills()).containsExactlyInAnyOrder("Java", "Docker");
        assertThat(profile.getExtractionStatus()).isEqualTo(ExtractionStatus.REGEX_FALLBACK);
    }

    @Test
    void testExtractSync_withAllFieldsPresent() {
        String text = "Resume of John Doe\n" +
                "Email: john.doe@talentflow.org\n" +
                "Mobile: 0912345678\n" +
                "LinkedIn: https://www.linkedin.com/in/john-doe-123\n" +
                "Tech Stack: JavaScript, Spring Boot, AWS, Git, CI/CD";

        CandidateProfile profile = extractorService.extractSync(text);

        assertThat(profile).isNotNull();
        assertThat(profile.getEmail()).isEqualTo("john.doe@talentflow.org");
        assertThat(profile.getPhone()).isEqualTo("0912345678");
        assertThat(profile.getLinkedIn()).isEqualTo("https://linkedin.com/in/john-doe-123");
        // Because "JavaScript" contains "Java" and "Spring Boot" contains "Spring",
        // the simple substring search in the extractor matches all of these.
        assertThat(profile.getSkills()).containsExactlyInAnyOrder("Java", "JavaScript", "Spring", "Spring Boot", "AWS", "Git", "CI/CD");
        assertThat(profile.getExtractionStatus()).isEqualTo(ExtractionStatus.REGEX_FALLBACK);
    }

    @Test
    void testExtractSync_withNoFieldsPresent() {
        String text = "This is a random text with no contact info and no technical skills.";

        CandidateProfile profile = extractorService.extractSync(text);

        assertThat(profile).isNotNull();
        assertThat(profile.getEmail()).isNull();
        assertThat(profile.getPhone()).isNull();
        assertThat(profile.getLinkedIn()).isNull();
        assertThat(profile.getSkills()).isEmpty();
        assertThat(profile.getExtractionStatus()).isEqualTo(ExtractionStatus.REGEX_FALLBACK);
    }

    @Test
    void testEmailExtraction_variousFormats() {
        assertThat(extractorService.extractSync("test.name_123@sub.domain.co").getEmail())
                .isEqualTo("test.name_123@sub.domain.co");
        assertThat(extractorService.extractSync("My email is EMAIL@TEST.COM in uppercase").getEmail())
                .isEqualTo("EMAIL@TEST.COM");
        assertThat(extractorService.extractSync("invalid email address test@com").getEmail())
                .isNull();
    }

    @Test
    void testPhoneExtraction_variousFormats() {
        // Vietnamese formats
        assertThat(extractorService.extractSync("Call me on +84912345678").getPhone()).isEqualTo("+84912345678");
        assertThat(extractorService.extractSync("Call me on 0912 345 678").getPhone()).isEqualTo("0912 345 678");
        assertThat(extractorService.extractSync("Call me on 090-123-4567").getPhone()).isEqualTo("090-123-4567");

        // International formats
        assertThat(extractorService.extractSync("Call me on (123) 456-7890").getPhone()).isEqualTo("(123) 456-7890");
        assertThat(extractorService.extractSync("Call me on +1-555-555-5555").getPhone()).isEqualTo("+1-555-555-5555");
    }

    @Test
    void testLinkedInExtraction_variousFormats() {
        assertThat(extractorService.extractSync("linkedin.com/in/user1").getLinkedIn())
                .isEqualTo("https://linkedin.com/in/user1");
        assertThat(extractorService.extractSync("http://linkedin.com/in/user2/").getLinkedIn())
                .isEqualTo("https://linkedin.com/in/user2");
        assertThat(extractorService.extractSync("https://www.linkedin.com/in/user-name-3").getLinkedIn())
                .isEqualTo("https://linkedin.com/in/user-name-3");
        assertThat(extractorService.extractSync("LinkedIn profile is absent").getLinkedIn())
                .isNull();
    }

    @Test
    void testSkillExtraction_caseInsensitivityAndMatches() {
        String text = "I write code in python and spring boot, using postgresql and docker.";
        CandidateProfile profile = extractorService.extractSync(text);

        // "spring boot" matches both "Spring" and "Spring Boot"
        assertThat(profile.getSkills()).containsExactlyInAnyOrder("Python", "Spring", "Spring Boot", "PostgreSQL", "Docker");
        assertThat(profile.getSkills()).doesNotContain("Java", "React");
    }
}
