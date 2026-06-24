package com.talentflow.cvparser.parser;

import com.talentflow.cvparser.shared.exception.ParsingException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PdfTextParserSecurityLimitTest {

    @Test
    void parseRejectsPdfExceedingConfiguredPageLimit() throws IOException {
        PdfTextParser parser = new PdfTextParser();
        ReflectionTestUtils.setField(parser, "maxPages", 1);
        Path pdf = createPdf(2);

        assertThatThrownBy(() -> parser.parse(pdf))
                .isInstanceOf(ParsingException.class)
                .satisfies(ex -> assertThat(((ParsingException) ex).getErrorCode()).isEqualTo("PDF_TOO_LONG"));

        Files.deleteIfExists(pdf);
    }

    @Test
    void parseAcceptsPdfWithinConfiguredPageLimit() throws IOException {
        PdfTextParser parser = new PdfTextParser();
        ReflectionTestUtils.setField(parser, "maxPages", 2);
        Path pdf = createPdf(2);

        String text = parser.parse(pdf);

        assertThat(text).isNotNull();
        Files.deleteIfExists(pdf);
    }

    @Test
    void parserDoesNotReusePdfTextStripperAcrossCallsToPreventStaleState() {
        // PDFTextStripper retains startPage/endPage between calls on the same thread.
        // Stale endPage=0 from a future code path that configures the stripper would cause
        // getText() to return "", silently triggering the expensive OCR fallback for a
        // plain-text PDF.  Fix: construct new PDFTextStripper() per call (O(1), no I/O).
        boolean hasThreadLocalStripper = Arrays.stream(PdfTextParser.class.getDeclaredFields())
                .anyMatch(f -> ThreadLocal.class.isAssignableFrom(f.getType()));

        assertThat(hasThreadLocalStripper)
                .as("PdfTextParser must not hold a ThreadLocal<PDFTextStripper>; " +
                    "use new PDFTextStripper() per call to prevent stale state across invocations on the same thread")
                .isFalse();
    }

    @Test
    void supportsMimeTypeCorrectly() {
        PdfTextParser parser = new PdfTextParser();
        assertThat(parser.supports("application/pdf")).isTrue();
        assertThat(parser.supports("APPLICATION/PDF")).isTrue();
        assertThat(parser.supports("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).isFalse();
        assertThat(parser.supports(null)).isFalse();
    }

    @Test
    void parseThrowsParsingExceptionOnIOException() {
        PdfTextParser parser = new PdfTextParser();
        Path nonExistentPath = Path.of("/non-existent-directory/cv.pdf");

        assertThatThrownBy(() -> parser.parse(nonExistentPath))
                .isInstanceOf(ParsingException.class)
                .hasMessageContaining("Failed to parse PDF file:");
    }

    private Path createPdf(int pages) throws IOException {
        Path pdfPath = Files.createTempFile("pdf-limit-", ".pdf");
        try (PDDocument document = new PDDocument()) {
            for (int i = 0; i < pages; i++) {
                document.addPage(new PDPage());
            }
            document.save(pdfPath.toFile());
        }
        return pdfPath;
    }
}
