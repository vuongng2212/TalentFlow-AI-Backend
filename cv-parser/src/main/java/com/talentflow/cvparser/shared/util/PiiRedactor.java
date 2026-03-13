package com.talentflow.cvparser.shared.util;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Utility for redacting PII (Personally Identifiable Information) from logs.
 * Prevents compliance violations by removing sensitive data before logging.
 */
@Component
public class PiiRedactor {

    // Email pattern: matches standard email formats
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
            Pattern.CASE_INSENSITIVE
    );

    // Phone patterns: matches various phone formats
    private static final Pattern PHONE_PATTERN = Pattern.compile(
            "(\\+?\\d{1,3}[-.]?)?\\(?\\d{2,4}\\)?[-.]?\\d{3,4}[-.]?\\d{3,4}"
    );

    // Vietnamese ID number (CCCD/CMND)
    private static final Pattern VN_ID_PATTERN = Pattern.compile(
            "\\b\\d{9,12}\\b"
    );

    // Credit card pattern (basic)
    private static final Pattern CREDIT_CARD_PATTERN = Pattern.compile(
            "\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b"
    );

    private static final String REDACTED_EMAIL = "[EMAIL_REDACTED]";
    private static final String REDACTED_PHONE = "[PHONE_REDACTED]";
    private static final String REDACTED_ID = "[ID_REDACTED]";
    private static final String REDACTED_CARD = "[CARD_REDACTED]";

    /**
     * Redact all PII from the given text.
     *
     * @param text Text potentially containing PII
     * @return Text with PII redacted
     */
    public String redact(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }

        String result = text;
        result = EMAIL_PATTERN.matcher(result).replaceAll(REDACTED_EMAIL);
        result = PHONE_PATTERN.matcher(result).replaceAll(REDACTED_PHONE);
        result = CREDIT_CARD_PATTERN.matcher(result).replaceAll(REDACTED_CARD);
        // Note: VN_ID_PATTERN can be too aggressive, use cautiously
        // result = VN_ID_PATTERN.matcher(result).replaceAll(REDACTED_ID);

        return result;
    }

    /**
     * Redact email addresses only.
     */
    public String redactEmail(String text) {
        if (text == null) return null;
        return EMAIL_PATTERN.matcher(text).replaceAll(REDACTED_EMAIL);
    }

    /**
     * Redact phone numbers only.
     */
    public String redactPhone(String text) {
        if (text == null) return null;
        return PHONE_PATTERN.matcher(text).replaceAll(REDACTED_PHONE);
    }

    /**
     * Static method for use in logging statements.
     */
    public static String sanitize(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        String result = EMAIL_PATTERN.matcher(text).replaceAll(REDACTED_EMAIL);
        result = PHONE_PATTERN.matcher(result).replaceAll(REDACTED_PHONE);
        return result;
    }
}
