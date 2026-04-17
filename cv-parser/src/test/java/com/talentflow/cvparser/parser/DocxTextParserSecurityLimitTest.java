package com.talentflow.cvparser.parser;

import com.talentflow.cvparser.shared.exception.DocumentTooLongException;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DocxTextParserSecurityLimitTest {

    @Test
    void parseRejectsDocxTextOverConfiguredLimit() throws IOException {
        DocxTextParser parser = new DocxTextParser();
        setParserLimits(parser, 10L);
        Path docxPath = createDocx("12345678901");

        assertThatThrownBy(() -> parser.parse(docxPath))
                .isInstanceOf(DocumentTooLongException.class);

        Files.deleteIfExists(docxPath);
    }

    @Test
    void parseAcceptsDocxWithinConfiguredLimit() throws IOException {
        DocxTextParser parser = new DocxTextParser();
        setParserLimits(parser, 1000L);
        Path docxPath = createDocx("John Doe");

        String text = parser.parse(docxPath);

        assertThat(text).isEqualTo("John Doe");
        Files.deleteIfExists(docxPath);
    }

    private void setParserLimits(DocxTextParser parser, long maxTextSize) {
        ReflectionTestUtils.setField(parser, "minInflateRatio", 0.01d);
        ReflectionTestUtils.setField(parser, "maxEntrySize", 20L * 1024 * 1024);
        ReflectionTestUtils.setField(parser, "maxTextSize", maxTextSize);
        parser.init();
    }

    private Path createDocx(String text) throws IOException {
        Path path = Files.createTempFile("docx-security-", ".docx");
        try (XWPFDocument document = new XWPFDocument();
             OutputStream outputStream = Files.newOutputStream(path)) {
            document.createParagraph().createRun().setText(text);
            document.write(outputStream);
        }
        return path;
    }
}
