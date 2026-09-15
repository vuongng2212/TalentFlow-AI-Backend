package com.talentflow.cvparser.parser;

import com.talentflow.cvparser.shared.exception.UnsupportedDocumentFormatException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.test.util.ReflectionTestUtils;
import org.mockito.Mockito;

import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ParserFactoryTest {

    @Test
    void parseCancelsOcrFutureWhenTimeoutOccurs() throws IOException {
        DocumentParser documentParser = mock(DocumentParser.class);
        TesseractOcrImpl ocrParser = mock(TesseractOcrImpl.class);
        ParserFactory parserFactory = new ParserFactory(List.of(documentParser), ocrParser);

        ReflectionTestUtils.setField(parserFactory, "minTextLengthThreshold", 100);
        ReflectionTestUtils.setField(parserFactory, "ocrTimeoutSeconds", 1L);

        Path pdfPath = createPdf();
        CompletableFuture<String> ocrFuture = new CompletableFuture<>();

        when(documentParser.supports("application/pdf")).thenReturn(true);
        when(documentParser.parse(pdfPath)).thenReturn("short");
        when(ocrParser.extractText(eq(pdfPath), anyString())).thenReturn(ocrFuture);

        String result = parserFactory.parse(pdfPath);

        assertThat(result).isEmpty();
        assertThat(ocrFuture.isCancelled()).isTrue();
        Files.deleteIfExists(pdfPath);
    }

    @Test
    void ocrFallbackTimeoutDefaultIsTightEnoughToPreventLongPipelineStall() throws NoSuchFieldException {
        // Hard-coded 120s default means an OCR failure blocks the RabbitMQ consumer thread for 2 minutes
        // and cannot be tuned per environment without recompiling.
        // With B1/B2 fixes a 10-page scan completes in < 30s; the default should reflect that.
        Field field = ParserFactory.class.getDeclaredField("ocrTimeoutSeconds");
        Value annotation = field.getAnnotation(Value.class);

        // Extract the default from "${app.parser.ocr-timeout-seconds:NNN}"
        String expr = annotation.value(); // e.g. "${app.parser.ocr-timeout-seconds:120}"
        long defaultSeconds = Long.parseLong(
                expr.substring(expr.lastIndexOf(':') + 1, expr.lastIndexOf('}')));

        assertThat(defaultSeconds)
                .as("ocrTimeoutSeconds default is %ds — trim to ≤ 60s and expose via " +
                    "app.parser.ocr-timeout-seconds in application.yml so it is tunable per environment",
                    defaultSeconds)
                .isLessThanOrEqualTo(60L);
    }

    @Test
    void parseThrowsUnsupportedDocumentFormatExceptionOnUnsupportedMimeType() throws IOException {
        DocumentParser docxParser = mock(DocumentParser.class);
        TesseractOcrImpl ocrParser = mock(TesseractOcrImpl.class);
        ParserFactory factory = new ParserFactory(List.of(docxParser), ocrParser);

        when(docxParser.supports(anyString())).thenReturn(false);

        Path tempFile = Files.createTempFile("unsupported-mime-", ".txt");
        Files.writeString(tempFile, "Some plain text content");

        try {
            assertThatThrownBy(() -> factory.parse(tempFile))
                    .isInstanceOf(UnsupportedDocumentFormatException.class)
                    .hasMessageContaining("Unsupported document format:");
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    @Test
    void parseReturnsTextDirectlyWithoutOcrWhenTextIsLongEnough() throws IOException {
        DocumentParser docxParser = mock(DocumentParser.class);
        TesseractOcrImpl ocrParser = mock(TesseractOcrImpl.class);
        ParserFactory factory = new ParserFactory(List.of(docxParser), ocrParser);

        ReflectionTestUtils.setField(factory, "minTextLengthThreshold", 10);

        when(docxParser.supports(anyString())).thenReturn(true);
        when(docxParser.parse(any(Path.class))).thenReturn("This extracted text is long enough.");

        Path tempFile = Files.createTempFile("success-parser-", ".docx");
        try {
            String result = factory.parse(tempFile);
            assertThat(result).isEqualTo("This extracted text is long enough.");
            Mockito.verifyNoInteractions(ocrParser);
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    @Test
    void parseReturnsEmptyStringWhenOcrCompletesExceptionally() throws IOException {
        DocumentParser docxParser = mock(DocumentParser.class);
        TesseractOcrImpl ocrParser = mock(TesseractOcrImpl.class);
        ParserFactory factory = new ParserFactory(List.of(docxParser), ocrParser);

        ReflectionTestUtils.setField(factory, "minTextLengthThreshold", 100);
        ReflectionTestUtils.setField(factory, "ocrTimeoutSeconds", 5L);

        when(docxParser.supports(anyString())).thenReturn(true);
        when(docxParser.parse(any(Path.class))).thenReturn("short");

        CompletableFuture<String> ocrFuture = new CompletableFuture<>();
        ocrFuture.completeExceptionally(new RuntimeException("Simulated OCR failure"));
        when(ocrParser.extractText(any(Path.class), anyString())).thenReturn(ocrFuture);

        Path tempFile = Files.createTempFile("ocr-fail-", ".docx");
        try {
            String result = factory.parse(tempFile);
            assertThat(result).isEmpty();
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    @Test
    void parseReturnsEmptyStringWhenOcrIsInterrupted() throws IOException {
        DocumentParser docxParser = mock(DocumentParser.class);
        TesseractOcrImpl ocrParser = mock(TesseractOcrImpl.class);
        ParserFactory factory = new ParserFactory(List.of(docxParser), ocrParser);

        ReflectionTestUtils.setField(factory, "minTextLengthThreshold", 100);
        ReflectionTestUtils.setField(factory, "ocrTimeoutSeconds", 5L);

        when(docxParser.supports(anyString())).thenReturn(true);
        when(docxParser.parse(any(Path.class))).thenReturn("short");

        CompletableFuture<String> ocrFuture = new CompletableFuture<>() {
            @Override
            public String get(long timeout, java.util.concurrent.TimeUnit unit) throws InterruptedException {
                throw new InterruptedException("Interrupted simulated");
            }
        };
        when(ocrParser.extractText(any(Path.class), anyString())).thenReturn(ocrFuture);

        Path tempFile = Files.createTempFile("ocr-interrupted-", ".docx");
        try {
            String result = factory.parse(tempFile);
            assertThat(result).isEmpty();
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    private Path createPdf() throws IOException {
        Path path = Files.createTempFile("parser-factory-", ".pdf");
        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage());
            document.save(path.toFile());
        }
        return path;
    }
}
