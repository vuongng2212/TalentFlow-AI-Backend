package com.talentflow.cvparser.parser;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
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

    private Path createPdf() throws IOException {
        Path path = Files.createTempFile("parser-factory-", ".pdf");
        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage());
            document.save(path.toFile());
        }
        return path;
    }
}
