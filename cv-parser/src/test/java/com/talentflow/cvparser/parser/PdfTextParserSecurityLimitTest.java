package com.talentflow.cvparser.parser;

import com.talentflow.cvparser.shared.exception.ParsingException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

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
