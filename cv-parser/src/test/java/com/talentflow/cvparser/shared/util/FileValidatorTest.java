package com.talentflow.cvparser.shared.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileValidatorTest {

    private FileValidator fileValidator;

    @BeforeEach
    void setUp() {
        fileValidator = new FileValidator();
    }

    @Test
    void testGettersAndSetters() {
        fileValidator.setMaxSizeMb(15);
        assertThat(fileValidator.getMaxSizeMb()).isEqualTo(15);

        fileValidator.setMaxPages(30);
        assertThat(fileValidator.getMaxPages()).isEqualTo(30);

        List<String> types = List.of("application/pdf", "text/plain");
        fileValidator.setAllowedTypes(types);
        assertThat(fileValidator.getAllowedTypes()).containsExactly("application/pdf", "text/plain");
    }

    @Test
    void testIsPdfAndIsDocx() {
        assertThat(fileValidator.isPdf("application/pdf")).isTrue();
        assertThat(fileValidator.isPdf("text/plain")).isFalse();

        assertThat(fileValidator.isDocx("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).isTrue();
        assertThat(fileValidator.isDocx("application/pdf")).isFalse();
    }

    @Test
    void testValidate_exceedsMaxSize() {
        long fileSize = 11 * 1024 * 1024; // 11 MB, default max is 10 MB
        InputStream inputStream = new ByteArrayInputStream(new byte[0]);

        assertThatThrownBy(() -> fileValidator.validate(inputStream, "test.pdf", fileSize))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exceeds maximum");
    }

    @Test
    void testValidate_validPdf() {
        // Tika parses "%PDF-" header and detects it as application/pdf
        byte[] pdfBytes = "%PDF-1.4\n%...".getBytes(StandardCharsets.UTF_8);
        InputStream inputStream = new ByteArrayInputStream(pdfBytes);

        String detected = fileValidator.validate(inputStream, "resume.pdf", pdfBytes.length);

        assertThat(detected).isEqualTo("application/pdf");
    }

    @Test
    void testValidate_disallowedType() {
        byte[] textBytes = "Hello World".getBytes(StandardCharsets.UTF_8);
        InputStream inputStream = new ByteArrayInputStream(textBytes);

        assertThatThrownBy(() -> fileValidator.validate(inputStream, "readme.txt", textBytes.length))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("is not allowed");
    }

    @Test
    void testValidate_customAllowedType() {
        fileValidator.setAllowedTypes(List.of("text/plain"));
        byte[] textBytes = "Hello World".getBytes(StandardCharsets.UTF_8);
        InputStream inputStream = new ByteArrayInputStream(textBytes);

        String detected = fileValidator.validate(inputStream, "readme.txt", textBytes.length);

        assertThat(detected).isEqualTo("text/plain");
    }

    @Test
    void testValidate_tikaIOException() {
        InputStream badStream = new InputStream() {
            @Override
            public int read() throws IOException {
                throw new IOException("Simulated read error");
            }
        };

        assertThatThrownBy(() -> fileValidator.validate(badStream, "error.pdf", 100))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unable to detect file type")
                .hasCauseInstanceOf(IOException.class);
    }

    @Test
    void testValidateFileKey_validKeys() {
        fileValidator.validateFileKey("uploads/cv-12345.pdf");
        fileValidator.validateFileKey("users_profiles/test.docx");
        fileValidator.validateFileKey("simple-key");
    }

    @Test
    void testValidateFileKey_nullOrEmpty() {
        assertThatThrownBy(() -> fileValidator.validateFileKey(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be null or empty");

        assertThatThrownBy(() -> fileValidator.validateFileKey(""))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be null or empty");
    }

    @Test
    void testValidateFileKey_pathTraversal() {
        List<String> badKeys = List.of(
                "../escape.pdf",
                "folder/..\\escape.pdf",
                "folder/%2e%2e%2fescape.pdf",
                "folder/%2e%2e/escape.pdf",
                "folder/..%2fescape.pdf",
                "folder/%2e%2e%5cescape.pdf"
        );

        for (String key : badKeys) {
            assertThatThrownBy(() -> fileValidator.validateFileKey(key))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("path traversal sequence");
        }
    }

    @Test
    void testValidateFileKey_invalidCharacters() {
        List<String> badKeys = List.of(
                "key$with$symbols.pdf",
                "user@email/profile.pdf",
                "file!name.pdf",
                "cv#1.pdf"
        );

        for (String key : badKeys) {
            assertThatThrownBy(() -> fileValidator.validateFileKey(key))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("contains invalid characters");
        }
    }

    @Test
    void testValidateFileKey_doubleSlash() {
        assertThatThrownBy(() -> fileValidator.validateFileKey("uploads//cv.pdf"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("invalid double slash");
    }

    @Test
    void testValidateFileKey_startsWithSlash() {
        assertThatThrownBy(() -> fileValidator.validateFileKey("/uploads/cv.pdf"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot start with slash");
    }

    @Test
    void testValidateBucket_validBuckets() {
        fileValidator.validateBucket("my-bucket");
        fileValidator.validateBucket("talentflow-cv-parser");
        fileValidator.validateBucket("bucket.name.123");
    }

    @Test
    void testValidateBucket_nullOrEmpty() {
        assertThatThrownBy(() -> fileValidator.validateBucket(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be null or empty");

        assertThatThrownBy(() -> fileValidator.validateBucket(""))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be null or empty");
    }

    @Test
    void testValidateBucket_invalidLength() {
        assertThatThrownBy(() -> fileValidator.validateBucket("bu"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must be 3-63 characters");

        String longBucket = "a".repeat(64);
        assertThatThrownBy(() -> fileValidator.validateBucket(longBucket))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must be 3-63 characters");
    }

    @Test
    void testValidateBucket_invalidCharacters() {
        List<String> badBuckets = List.of(
                "MyBucket",            // Uppercase
                "bucket_name",          // Underscore not allowed
                "-bucket",             // Starts with hyphen
                "bucket-",             // Ends with hyphen
                ".bucket",             // Starts with dot
                "bucket.",             // Ends with dot
                "bucket@name"          // Special char
        );

        for (String bucket : badBuckets) {
            assertThatThrownBy(() -> fileValidator.validateBucket(bucket))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("contains invalid characters");
        }
    }
}
