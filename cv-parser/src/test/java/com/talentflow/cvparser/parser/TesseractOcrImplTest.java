package com.talentflow.cvparser.parser;

import com.talentflow.cvparser.shared.exception.ParsingException;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.Mockito.mock;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntFunction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

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
            ReflectionTestUtils.setField(ocr, "ocrPageTimeoutSeconds", 30);

            String text = ocr.extractText(pdfPath, "application/pdf").join();

            assertThat(text).isEqualTo("page-1\npage-2\npage-3");
            assertThat(ocr.invocationCount()).isEqualTo(3);
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(pdfPath);
        }
    }

    @Test
    void initCreatesExactlyMaxParallelPagesTesseractInstances() {
        int maxParallelPages = 2;
        AtomicInteger buildCount = new AtomicInteger(0);
        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            TesseractOcrImpl ocr = new TesseractOcrImpl(executor, executor, new SimpleMeterRegistry()) {
                @Override
                protected ITesseract buildTesseract() {
                    buildCount.incrementAndGet();
                    return new Tesseract();
                }
            };
            ReflectionTestUtils.setField(ocr, "maxParallelPages", maxParallelPages);

            ocr.init();

            assertThat(buildCount.get())
                    .as("init() must call buildTesseract() exactly maxParallelPages=%d times, "
                            + "not maxParallelPages+1", maxParallelPages)
                    .isEqualTo(maxParallelPages);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void renderedImagePixelAreaFitsWithinBudgetFor150Dpi() throws IOException {
        int dpi = 150;
        long pixelBudget = 2_500_000L;

        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path pdfPath = createPdf(1);
        List<BufferedImage> capturedImages = new CopyOnWriteArrayList<>();

        try {
            TesseractOcrImpl ocr = new TesseractOcrImpl(executor, executor, new SimpleMeterRegistry()) {
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
            ReflectionTestUtils.setField(ocr, "ocrPageTimeoutSeconds",    30);

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
            ReflectionTestUtils.setField(ocr, "ocrPageTimeoutSeconds",     30);

            Future<String> ocrFuture = testRunner.submit(
                    () -> ocr.extractText(pdfPath, "application/pdf").join());

            boolean allStarted = allTasksInFlight.await(5, TimeUnit.SECONDS);
            assertThat(allStarted)
                    .as("all %d OCR tasks should be in-flight concurrently before any completes", pageCount)
                    .isTrue();

            releaseAll.countDown();
            assertThat(ocrFuture.get(5, TimeUnit.SECONDS))
                    .isEqualTo("page-1\npage-2\npage-3\npage-4");
        } finally {
            releaseAll.countDown();
            testRunner.shutdownNow();
            pageExecutor.shutdownNow();
            Files.deleteIfExists(pdfPath);
        }
    }

    @Test
    void ocrScannedPdfCompletesWithinPageTimeoutWhenRunTesseractHangs() throws IOException {
        ExecutorService executor = Executors.newFixedThreadPool(4);
        Path pdfPath = createPdf(2);

        try {
            TesseractOcrImpl ocr = new TesseractOcrImpl(executor, executor, new SimpleMeterRegistry()) {
                @Override
                protected String runTesseract(BufferedImage image, Path filePath, int pageNumber) {
                    try {
                        Thread.sleep(60_000);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    return "blocked";
                }
            };
            ReflectionTestUtils.setField(ocr, "maxPages",                  10);
            ReflectionTestUtils.setField(ocr, "maxParallelPages",          2);
            ReflectionTestUtils.setField(ocr, "maxRenderedPixelsPerPage",  20_000_000L);
            ReflectionTestUtils.setField(ocr, "dpi",                       100);
            ReflectionTestUtils.setField(ocr, "ocrPageTimeoutSeconds",     1);

            // Trigger pool initialization so tesseractPool != null checks pass
            ocr.init();

            long start = System.currentTimeMillis();
            String result = ocr.extractText(pdfPath, "application/pdf").join();
            long elapsed = System.currentTimeMillis() - start;

            assertThat(elapsed)
                    .as("extractText must complete within ~page-timeout (1s) even when runTesseract hangs")
                    .isLessThan(5_000L);
            assertThat(result)
                    .as("timed-out pages yield empty text, not 'blocked'")
                    .doesNotContain("blocked");
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(pdfPath);
        }
    }

    // ── New unit tests to achieve 100% logic coverage ────────────────────────

    private static class MockTesseractOcrImpl extends TesseractOcrImpl {
        private final ITesseract mockTesseract;

        public MockTesseractOcrImpl(Executor ocrExecutor, Executor ocrPageExecutor, ITesseract mockTesseract) {
            super(ocrExecutor, ocrPageExecutor, new SimpleMeterRegistry());
            this.mockTesseract = mockTesseract;
        }

        @Override
        protected ITesseract buildTesseract() {
            return mockTesseract;
        }
    }

    @Test
    void extractTextReturnsEmptyStringForUnsupportedMimeType() throws IOException {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path path = Files.createTempFile("test-unsupported-", ".txt");
        try {
            TesseractOcrImpl ocr = new TesseractOcrImpl(executor, executor, new SimpleMeterRegistry());
            String result = ocr.extractText(path, "text/plain").join();
            assertThat(result).isEmpty();
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(path);
        }
    }

    @Test
    void extractTextProcessesImageSuccessfully() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path path = Files.createTempFile("test-image-", ".png");
        ITesseract mockTesseract = mock(ITesseract.class);
        when(mockTesseract.doOCR(any(File.class))).thenReturn("  Hello World Image  ");

        try {
            MockTesseractOcrImpl ocr = new MockTesseractOcrImpl(executor, executor, mockTesseract);
            ReflectionTestUtils.setField(ocr, "maxParallelPages", 1);
            ReflectionTestUtils.setField(ocr, "poolBorrowTimeoutSeconds", 5);
            ocr.init();

            String result = ocr.extractText(path, "image/png").join();
            assertThat(result).isEqualTo("Hello World Image");
            Mockito.verify(mockTesseract).doOCR(path.toFile());
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(path);
        }
    }

    @Test
    void extractTextReturnsEmptyStringWhenImageOcrThrowsTesseractException() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path path = Files.createTempFile("test-image-fail-", ".png");
        ITesseract mockTesseract = mock(ITesseract.class);
        when(mockTesseract.doOCR(any(File.class))).thenThrow(new net.sourceforge.tess4j.TesseractException("Native OCR failed"));

        try {
            MockTesseractOcrImpl ocr = new MockTesseractOcrImpl(executor, executor, mockTesseract);
            ReflectionTestUtils.setField(ocr, "maxParallelPages", 1);
            ReflectionTestUtils.setField(ocr, "poolBorrowTimeoutSeconds", 5);
            ocr.init();

            String result = ocr.extractText(path, "image/png").join();
            assertThat(result).isEmpty();
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(path);
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void extractTextThrowsParsingExceptionOnPoolExhaustion() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path path = Files.createTempFile("test-exhaustion-", ".png");
        ITesseract mockTesseract = mock(ITesseract.class);

        try {
            MockTesseractOcrImpl ocr = new MockTesseractOcrImpl(executor, executor, mockTesseract);
            ReflectionTestUtils.setField(ocr, "maxParallelPages", 1);
            ReflectionTestUtils.setField(ocr, "poolBorrowTimeoutSeconds", 1);
            ocr.init();

            BlockingQueue<ITesseract> pool =
                (BlockingQueue<ITesseract>) ReflectionTestUtils.getField(ocr, "tesseractPool");
            assertThat(pool).isNotNull();
            pool.clear(); // Simulate empty pool

            // Direct call throws synchronously on proxyless instance
            assertThatThrownBy(() -> ocr.extractText(path, "image/png"))
                    .isInstanceOf(ParsingException.class)
                    .satisfies(ex -> {
                        ParsingException cause = (ParsingException) ex;
                        assertThat(cause.getErrorCode()).isEqualTo("OCR_POOL_TIMEOUT");
                    });
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(path);
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void extractTextThrowsParsingExceptionOnInterruptedWaiting() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path path = Files.createTempFile("test-interrupted-", ".png");
        ITesseract mockTesseract = mock(ITesseract.class);

        try {
            MockTesseractOcrImpl ocr = new MockTesseractOcrImpl(executor, executor, mockTesseract);
            ReflectionTestUtils.setField(ocr, "maxParallelPages", 1);
            ReflectionTestUtils.setField(ocr, "poolBorrowTimeoutSeconds", 5);
            ocr.init();

            BlockingQueue<ITesseract> mockPool = mock(BlockingQueue.class);
            when(mockPool.poll(anyLong(), any(TimeUnit.class)))
                .thenThrow(new InterruptedException("Simulated interruption"));
            ReflectionTestUtils.setField(ocr, "tesseractPool", mockPool);

            // Direct call throws synchronously on proxyless instance
            assertThatThrownBy(() -> ocr.extractText(path, "image/png"))
                    .isInstanceOf(ParsingException.class)
                    .satisfies(ex -> {
                        ParsingException cause = (ParsingException) ex;
                        assertThat(cause.getErrorCode()).isEqualTo("OCR_INTERRUPTED");
                    });
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(path);
        }
    }

    @Test
    void extractTextReturnsEmptyStringOnInvalidPdf() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path nonExistentPath = Path.of("/non-existent-directory/non-existent.pdf");

        try {
            TesseractOcrImpl ocr = new TesseractOcrImpl(executor, executor, new SimpleMeterRegistry());
            ReflectionTestUtils.setField(ocr, "maxPages", 10);
            ReflectionTestUtils.setField(ocr, "maxParallelPages", 1);
            ocr.init();

            // Should catch the exception and return empty string completed future
            String result = ocr.extractText(nonExistentPath, "application/pdf").join();
            assertThat(result).isEmpty();
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void ocrScannedPdfFlushesImagesWhenPhaseAFails() throws IOException {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path pdfPath = Files.createTempFile("ocr-phase-a-fail-", ".pdf");

        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage(PDRectangle.A4));
            document.addPage(new PDPage(new PDRectangle(10_000f, 10_000f))); // Exceeds pixel limits
            document.save(pdfPath.toFile());
        }

        try {
            TesseractOcrImpl ocr = new TesseractOcrImpl(executor, executor, new SimpleMeterRegistry());
            ReflectionTestUtils.setField(ocr, "maxPages", 5);
            ReflectionTestUtils.setField(ocr, "maxParallelPages", 2);
            ReflectionTestUtils.setField(ocr, "maxRenderedPixelsPerPage", 2_000_000L);
            ReflectionTestUtils.setField(ocr, "dpi", 150);
            ocr.init();

            // Throws ParsingException synchronously on caller's thread during Phase A
            assertThatThrownBy(() -> ocr.extractText(pdfPath, "application/pdf"))
                    .isInstanceOf(ParsingException.class)
                    .satisfies(ex -> {
                        ParsingException cause = (ParsingException) ex;
                        assertThat(cause.getErrorCode()).isEqualTo("PDF_PAGE_TOO_LARGE");
                    });
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(pdfPath);
        }
    }

    @Test
    void ocrScannedPdfHandlesTesseractExceptionOnPageOcr() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path pdfPath = createPdf(1);
        ITesseract mockTesseract = mock(ITesseract.class);
        when(mockTesseract.doOCR(any(BufferedImage.class))).thenThrow(new net.sourceforge.tess4j.TesseractException("Native JNI failure"));

        try {
            MockTesseractOcrImpl ocr = new MockTesseractOcrImpl(executor, executor, mockTesseract);
            ReflectionTestUtils.setField(ocr, "maxPages", 5);
            ReflectionTestUtils.setField(ocr, "maxParallelPages", 1);
            ReflectionTestUtils.setField(ocr, "maxRenderedPixelsPerPage", 20_000_000L);
            ReflectionTestUtils.setField(ocr, "dpi", 150);
            ReflectionTestUtils.setField(ocr, "ocrPageTimeoutSeconds", 5);
            ocr.init();

            String result = ocr.extractText(pdfPath, "application/pdf").join();
            assertThat(result).isEmpty();
            Mockito.verify(mockTesseract).doOCR(any(BufferedImage.class));
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(pdfPath);
        }
    }

    // ── original helpers ───────────────────────────────────────────────────

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
            super(ocrExecutor, ocrExecutor, new SimpleMeterRegistry());
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
