package com.talentflow.cvparser.parser;

import com.talentflow.cvparser.shared.exception.ParsingException;
import com.talentflow.cvparser.shared.exception.UnsupportedDocumentFormatException;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.openxml4j.opc.PackageAccess;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

class DocxTextParserTest {

    @Test
    void supportsMimeTypeCorrectly() {
        DocxTextParser parser = new DocxTextParser();
        assertThat(parser.supports("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).isTrue();
        assertThat(parser.supports("APPLICATION/VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT")).isTrue();
        assertThat(parser.supports("application/pdf")).isFalse();
        assertThat(parser.supports(null)).isFalse();
    }

    @Test
    void parseThrowsUnsupportedDocumentFormatExceptionOnNotOfficeXmlFileException() throws IOException {
        DocxTextParser parser = new DocxTextParser();
        Path tempFile = Files.createTempFile("docx-invalid-", ".docx");
        Files.writeString(tempFile, "This is plain text, not a zip file");

        try {
            assertThatThrownBy(() -> parser.parse(tempFile))
                    .isInstanceOf(UnsupportedDocumentFormatException.class)
                    .hasMessageContaining("Vui lòng lưu CV dưới định dạng .docx");
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    @Test
    void parseThrowsParsingExceptionOnInvalidFormatException() throws IOException {
        DocxTextParser parser = new DocxTextParser();
        Path tempFile = Files.createTempFile("docx-corrupt-", ".docx");

        try (MockedStatic<OPCPackage> mockedOpc = Mockito.mockStatic(OPCPackage.class)) {
            mockedOpc.when(() -> OPCPackage.open(any(File.class), any(PackageAccess.class)))
                     .thenThrow(new InvalidFormatException("Invalid format simulated"));

            assertThatThrownBy(() -> parser.parse(tempFile))
                    .isInstanceOf(ParsingException.class)
                    .hasMessageContaining("File CV bị hỏng hoặc chứa cấu trúc nguy hiểm.");
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    @Test
    void parseThrowsParsingExceptionOnIOException() throws IOException {
        DocxTextParser parser = new DocxTextParser();
        Path tempFile = Files.createTempFile("docx-io-", ".docx");

        try (MockedStatic<OPCPackage> mockedOpc = Mockito.mockStatic(OPCPackage.class);
             MockedConstruction<XWPFDocument> mockDoc = Mockito.mockConstruction(XWPFDocument.class);
             MockedConstruction<XWPFWordExtractor> mockExtractor = Mockito.mockConstruction(XWPFWordExtractor.class,
                     (mock, context) -> {
                         // Mocking close() to throw IOException is allowed since close() declares throws IOException.
                         // This successfully bubbles up as an IOException from the try-with-resources block.
                         doThrow(new IOException("Simulated I/O error")).when(mock).close();
                     })) {

            mockedOpc.when(() -> OPCPackage.open(any(File.class), any(PackageAccess.class)))
                     .thenReturn(mock(OPCPackage.class));

            assertThatThrownBy(() -> parser.parse(tempFile))
                    .isInstanceOf(ParsingException.class)
                    .hasMessageContaining("Lỗi đọc file DOCX trên hệ thống.")
                    .hasCauseInstanceOf(IOException.class);
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    @Test
    void parseThrowsParsingExceptionOnUnexpectedException() throws IOException {
        DocxTextParser parser = new DocxTextParser();
        Path tempFile = Files.createTempFile("docx-unexpected-", ".docx");

        try (MockedStatic<OPCPackage> mockedOpc = Mockito.mockStatic(OPCPackage.class);
             MockedConstruction<XWPFDocument> mockDoc = Mockito.mockConstruction(XWPFDocument.class);
             MockedConstruction<XWPFWordExtractor> mockExtractor = Mockito.mockConstruction(XWPFWordExtractor.class,
                     (mock, context) -> {
                         when(mock.getText()).thenThrow(new RuntimeException("Unexpected runtime error simulated"));
                     })) {

            mockedOpc.when(() -> OPCPackage.open(any(File.class), any(PackageAccess.class)))
                     .thenReturn(mock(OPCPackage.class));

            assertThatThrownBy(() -> parser.parse(tempFile))
                    .isInstanceOf(ParsingException.class)
                    .hasMessageContaining("Lỗi không xác định khi xử lý file CV.")
                    .hasCauseInstanceOf(RuntimeException.class);
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    @Test
    void parsePropagatesParsingException() throws IOException {
        DocxTextParser parser = new DocxTextParser();
        Path tempFile = Files.createTempFile("docx-parsing-exc-", ".docx");

        try (MockedStatic<OPCPackage> mockedOpc = Mockito.mockStatic(OPCPackage.class);
             MockedConstruction<XWPFDocument> mockDoc = Mockito.mockConstruction(XWPFDocument.class);
             MockedConstruction<XWPFWordExtractor> mockExtractor = Mockito.mockConstruction(XWPFWordExtractor.class,
                     (mock, context) -> {
                         when(mock.getText()).thenThrow(new ParsingException("Pre-existing error", "ERR_CODE"));
                     })) {

            mockedOpc.when(() -> OPCPackage.open(any(File.class), any(PackageAccess.class)))
                     .thenReturn(mock(OPCPackage.class));

            assertThatThrownBy(() -> parser.parse(tempFile))
                    .isInstanceOf(ParsingException.class)
                    .hasMessageContaining("Pre-existing error")
                    .satisfies(ex -> assertThat(((ParsingException) ex).getErrorCode()).isEqualTo("ERR_CODE"));
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    @Test
    void parseHandlesNullExtractedText() throws IOException {
        DocxTextParser parser = new DocxTextParser();
        Path tempFile = Files.createTempFile("docx-null-text-", ".docx");

        try (MockedStatic<OPCPackage> mockedOpc = Mockito.mockStatic(OPCPackage.class);
             MockedConstruction<XWPFDocument> mockDoc = Mockito.mockConstruction(XWPFDocument.class);
             MockedConstruction<XWPFWordExtractor> mocked = Mockito.mockConstruction(XWPFWordExtractor.class,
                (mock, context) -> {
                    when(mock.getText()).thenReturn(null);
                })) {

            mockedOpc.when(() -> OPCPackage.open(any(File.class), any(PackageAccess.class)))
                     .thenReturn(mock(OPCPackage.class));

            String result = parser.parse(tempFile);
            assertThat(result).isEmpty();
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }
}
