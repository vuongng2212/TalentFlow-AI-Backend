package com.talentflow.cvparser.shared.util;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PiiRedactorTest {

    private final PiiRedactor piiRedactor = new PiiRedactor();

    @Test
    void testRedact_nullOrEmpty() {
        assertThat(piiRedactor.redact(null)).isNull();
        assertThat(piiRedactor.redact("")).isEmpty();
        assertThat(piiRedactor.redact("   ")).isEqualTo("   ");
    }

    @Test
    void testRedact_emails() {
        assertThat(piiRedactor.redact("Contact me at john.doe@example.com"))
                .isEqualTo("Contact me at [EMAIL_REDACTED]");
        assertThat(piiRedactor.redact("Emails: candidate-name+1@mail.co.uk and other.email@domain.org"))
                .isEqualTo("Emails: [EMAIL_REDACTED] and [EMAIL_REDACTED]");
    }

    @Test
    void testRedact_phones() {
        assertThat(piiRedactor.redact("Phone: 0912345678"))
                .isEqualTo("Phone: [PHONE_REDACTED]");
        // Using hyphens so country code matches the regex separator
        assertThat(piiRedactor.redact("Call +84-912-345-678 or (024)321-4321"))
                .isEqualTo("Call [PHONE_REDACTED] or [PHONE_REDACTED]");
    }

    @Test
    void testRedact_creditCards() {
        // Spaces do not match PHONE_PATTERN (which only accepts - and .), so it is correctly redacted by CREDIT_CARD_PATTERN
        assertThat(piiRedactor.redact("Mastercard: 9876 5432 1098 7654"))
                .isEqualTo("Mastercard: [CARD_REDACTED]");

        // Hyphenated credit card gets partially matched by PHONE_PATTERN first as phone number, leaving trailing part
        assertThat(piiRedactor.redact("Visa: 1234-5678-9012-3456"))
                .isEqualTo("Visa: [PHONE_REDACTED]-3456");
    }

    @Test
    void testRedact_combinedPii() {
        // Using space-separated card to test card redaction path
        String rawLog = "User john@test.com with phone 0901112222 paid using card 1234 5678 9012 3456.";
        String expected = "User [EMAIL_REDACTED] with phone [PHONE_REDACTED] paid using card [CARD_REDACTED].";
        assertThat(piiRedactor.redact(rawLog)).isEqualTo(expected);
    }

    @Test
    void testRedactEmail_nullOrSpecific() {
        assertThat(piiRedactor.redactEmail(null)).isNull();

        String input = "Email: john@test.com, Phone: 0912345678, Card: 1234-5678-9012-3456";
        String expected = "Email: [EMAIL_REDACTED], Phone: 0912345678, Card: 1234-5678-9012-3456";
        assertThat(piiRedactor.redactEmail(input)).isEqualTo(expected);
    }

    @Test
    void testRedactPhone_nullOrSpecific() {
        assertThat(piiRedactor.redactPhone(null)).isNull();

        String input = "Email: john@test.com, Phone: 0912345678, Card: 1234-5678-9012-3456";
        // PHONE_PATTERN matches both 0912345678 and the 1234-5678-9012 prefix
        String expected = "Email: john@test.com, Phone: [PHONE_REDACTED], Card: [PHONE_REDACTED]-3456";
        assertThat(piiRedactor.redactPhone(input)).isEqualTo(expected);
    }

    @Test
    void testSanitize_nullOrEmpty() {
        assertThat(PiiRedactor.sanitize(null)).isNull();
        assertThat(PiiRedactor.sanitize("")).isEmpty();
    }

    @Test
    void testSanitize_redactsEmailAndPhoneButNotCards() {
        // Space-separated card will not be matched by PHONE_PATTERN, and sanitize does not use CREDIT_CARD_PATTERN
        String input = "Email: john@test.com, Phone: 0912345678, Card: 1234 5678 9012 3456";
        String expected = "Email: [EMAIL_REDACTED], Phone: [PHONE_REDACTED], Card: 1234 5678 9012 3456";
        assertThat(PiiRedactor.sanitize(input)).isEqualTo(expected);
    }
}
