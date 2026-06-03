package com.talentflow.cvparser.parser;

import com.talentflow.cvparser.shared.exception.ParsingException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntFunction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TesseractOcrImplTest {

    @Test
    void extractTextRejectsPdfExceedingMaxPages() throws IOException {
        ExecutorService executor = Executors.newFixedThreadPool(4);
        Path pdfPath = createPdf(2);
        try {
            StubTesseractOcrImpl ocr = new StubTesseractOcrImpl(executor, page -> "page-" + page);
            ReflectionTestUtils.setField(ocr, "maxPages", 1);
            ReflectionTestUtils.setField(ocr, "maxParallelPages", 2);
            ReflectionTestUtils.setField(ocr, "maxRenderedPixelsPerPage", 20_000_000L);
            ReflectionTestUtils.setField(ocr, "dpi", 100);

            assertThatThrownBy(() -> ocr.extractText(pdfPath, "application/pdf"))
                    .isInstanceOf(ParsingException.class)
                    .satisfies(ex -> assertThat(((ParsingException) ex).getErrorCode()).isEqualTo("PDF_TOO_LONG"));
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(pdfPath);
        }
    }

    @Test
    void extractTextRejectsPdfPageWithOversizedRenderedPixels() throws IOException {
        ExecutorService executor = Executors.newFixedThreadPool(4);
        Path pdfPath = createPdfWithPageSize(10_000f, 10_000f);
        try {
            StubTesseractOcrImpl ocr = new StubTesseractOcrImpl(executor, page -> "page-" + page);
            ReflectionTestUtils.setField(ocr, "maxPages", 5);
            ReflectionTestUtils.setField(ocr, "maxParallelPages", 2);
            ReflectionTestUtils.setField(ocr, "maxRenderedPixelsPerPage", 1_000_000L);
            ReflectionTestUtils.setField(ocr, "dpi", 300);

            assertThatThrownBy(() -> ocr.extractText(pdfPath, "application/pdf"))
                    .isInstanceOf(ParsingException.class)
                    .satisfies(ex -> assertThat(((ParsingException) ex).getErrorCode()).isEqualTo("PDF_PAGE_TOO_LARGE"));
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(pdfPath);
        }
    }

    @Test
    void extractTextAggregatesResultsInPageOrderWithParallelTasks() throws IOException {
        ExecutorService executor = Executors.newFixedThreadPool(4);
        Path pdfPath = createPdf(3);
        try {
            StubTesseractOcrImpl ocr = new StubTesseractOcrImpl(executor, page -> {
                if (page == 1) {
                    try {
                        Thread.sleep(120);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }
                return "page-" + page;
            });
            ReflectionTestUtils.setField(ocr, "maxPages", 10);
            ReflectionTestUtils.setField(ocr, "maxParallelPages", 2);
            ReflectionTestUtils.setField(ocr, "maxRenderedPixelsPerPage", 20_000_000L);
            ReflectionTestUtils.setField(ocr, "dpi", 100);

            String text = ocr.extractText(pdfPath, "application/pdf").join();

            assertThat(text).isEqualTo("page-1\npage-2\npage-3");
            assertThat(ocr.invocationCount()).isEqualTo(3);
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(pdfPath);
        }
    }

    private Path createPdf(int pages) throws IOException {
        Path pdfPath = Files.createTempFile("ocr-pages-", ".pdf");
        try (PDDocument document = new PDDocument()) {
            for (int i = 0; i < pages; i++) {
                document.addPage(new PDPage());
            }
            document.save(pdfPath.toFile());
        }
        return pdfPath;
    }

    private Path createPdfWithPageSize(float widthPoints, float heightPoints) throws IOException {
        Path pdfPath = Files.createTempFile("ocr-pages-size-", ".pdf");
        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage(new PDRectangle(widthPoints, heightPoints)));
            document.save(pdfPath.toFile());
        }
        return pdfPath;
    }

    private static final class StubTesseractOcrImpl extends TesseractOcrImpl {
        private final IntFunction<String> pageHandler;
        private final AtomicInteger invocationCounter = new AtomicInteger(0);

        private StubTesseractOcrImpl(Executor ocrExecutor, IntFunction<String> pageHandler) {
            super(ocrExecutor, ocrExecutor);
            this.pageHandler = pageHandler;
        }

        @Override
        protected String runTesseract(BufferedImage image, Path filePath, int pageNumber) {
            invocationCounter.incrementAndGet();
            return pageHandler.apply(pageNumber);
        }

        private int invocationCount() {
            return invocationCounter.get();
        }
    }
}
