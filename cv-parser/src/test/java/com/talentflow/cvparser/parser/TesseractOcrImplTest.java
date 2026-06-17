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
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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

    @Test
    void renderedImagePixelAreaFitsWithinBudgetFor150Dpi() throws IOException {
        // A4 page at 300 DPI → ~2480 × 3508 ≈ 8.7M pixels (old default — bottleneck B2).
        // A4 page at 150 DPI → ~1240 × 1754 ≈ 2.2M pixels (target default).
        // Assertion threshold sits between the two; the test fails at 300 DPI and passes at 150 DPI.
        int dpi = 150;
        long pixelBudget = 2_500_000L;

        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path pdfPath = createPdf(1);
        List<BufferedImage> capturedImages = new CopyOnWriteArrayList<>();

        try {
            TesseractOcrImpl ocr = new TesseractOcrImpl(executor, executor) {
                @Override
                protected String runTesseract(BufferedImage image, Path filePath, int pageNumber) {
                    capturedImages.add(image);
                    return "";
                }
            };
            ReflectionTestUtils.setField(ocr, "maxPages",                 10);
            ReflectionTestUtils.setField(ocr, "maxParallelPages",         1);
            ReflectionTestUtils.setField(ocr, "maxRenderedPixelsPerPage", 20_000_000L);
            ReflectionTestUtils.setField(ocr, "dpi",                      dpi);

            ocr.extractText(pdfPath, "application/pdf").join();

            assertThat(capturedImages).hasSize(1);
            long pixelArea = (long) capturedImages.get(0).getWidth()
                           * capturedImages.get(0).getHeight();
            assertThat(pixelArea)
                    .as("pixel area at dpi=%d must fit within 150-DPI budget (%d px²)", dpi, pixelBudget)
                    .isLessThan(pixelBudget);
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(pdfPath);
        }
    }

    @Test
    void ocrScannedPdfSubmitsAllPagesOcrConcurrentlyWithoutBatching() throws Exception {
        // 4-page PDF, maxParallelPages=2.
        // Old design batches pages in groups of maxParallelPages and blocks between batches —
        // so at most 2 OCR tasks are ever in-flight simultaneously.
        // New two-phase design submits all 4 tasks at once; all 4 must be in-flight before any completes.
        int pageCount = 4;
        ExecutorService pageExecutor = Executors.newFixedThreadPool(pageCount);
        ExecutorService testRunner   = Executors.newSingleThreadExecutor();
        Path pdfPath = createPdf(pageCount);

        CountDownLatch allTasksInFlight = new CountDownLatch(pageCount);
        CountDownLatch releaseAll       = new CountDownLatch(1);

        try {
            StubTesseractOcrImpl ocr = new StubTesseractOcrImpl(pageExecutor, page -> {
                allTasksInFlight.countDown();
                try { releaseAll.await(5, TimeUnit.SECONDS); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                return "page-" + page;
            });
            ReflectionTestUtils.setField(ocr, "maxPages",                  10);
            ReflectionTestUtils.setField(ocr, "maxParallelPages",          2);
            ReflectionTestUtils.setField(ocr, "maxRenderedPixelsPerPage",  20_000_000L);
            ReflectionTestUtils.setField(ocr, "dpi",                       100);

            // extractText blocks testRunner while page tasks wait on releaseAll
            Future<String> ocrFuture = testRunner.submit(
                    () -> ocr.extractText(pdfPath, "application/pdf").join());

            // All pageCount OCR tasks must start before any completes.
            // Under old batching logic only maxParallelPages=2 tasks are submitted first,
            // so this await times out and the assertion below fails.
            boolean allStarted = allTasksInFlight.await(5, TimeUnit.SECONDS);
            assertThat(allStarted)
                    .as("all %d OCR tasks should be in-flight concurrently before any completes", pageCount)
                    .isTrue();

            releaseAll.countDown();
            assertThat(ocrFuture.get(5, TimeUnit.SECONDS))
                    .isEqualTo("page-1\npage-2\npage-3\npage-4");
        } finally {
            releaseAll.countDown(); // safety: unblock tasks if assertion failed
            testRunner.shutdownNow();
            pageExecutor.shutdownNow();
            Files.deleteIfExists(pdfPath);
        }
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
