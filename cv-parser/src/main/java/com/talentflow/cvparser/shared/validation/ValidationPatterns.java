package com.talentflow.cvparser.shared.validation;

/**
 * Shared regular expressions and validation constants.
 */
public final class ValidationPatterns {

    private ValidationPatterns() {
        // Utility class
    }

    public static final String UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
}
