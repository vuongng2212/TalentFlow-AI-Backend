package com.talentflow.cvparser.parser;

import com.talentflow.cvparser.shared.exception.ParsingException;
import lombok.extern.slf4j.Slf4j;
import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

@Slf4j
@Service
public class TesseractOcrImpl {

    private static final String MIME_PDF  = "application/pdf";
    private final Executor ocrExecutor;
    private final Executor ocrPageExecutor;
    private static final String MIME_PNG  = "image/png";
    private static final String MIME_JPEG = "image/jpeg";
    private static final String MIME_TIFF = "image/tiff";
    private static final String MIME_BMP  = "image/bmp";

    @Value("${tesseract.data-path:/usr/share/tesseract-ocr/5/tessdata}")
    private String tessdataPath;

    @Value("${tesseract.language:eng+vie}")
    private String language;

    @Value("${app.ocr.dpi:300}")
    private int dpi;

    @Value("${app.ocr.max-pages:20}")
    private int maxPages;

    @Value("${app.ocr.max-parallel-pages:2}")
    private int maxParallelPages;

    @Value("${app.ocr.max-rendered-pixels-per-page:20000000}")
    private long maxRenderedPixelsPerPage;

    public TesseractOcrImpl(
            @Qualifier("ocrExecutor") Executor ocrExecutor,
            @Qualifier("ocrPageExecutor") Executor ocrPageExecutor
    ) {
        this.ocrExecutor = ocrExecutor;
        this.ocrPageExecutor = ocrPageExecutor;
    }

    @PostConstruct
    public void init() {
        log.info("Initialized TesseractOcrImpl. maxPages={}, maxParallelPages={}, maxRenderedPixelsPerPage={}, dpi={}, language={}, tessdataPath={}",
                maxPages, maxParallelPages, maxRenderedPixelsPerPage, dpi, language, tessdataPath);
    }

    @Async("ocrExecutor")
    public CompletableFuture<String> extractText(Path filePath) {
        log.info("OCR started. file=[{}], thread=[{}]",
                filePath.getFileName(), Thread.currentThread().getName());
        try {
            String mimeType = new Tika().detect(filePath.toFile());
            String result = switch (mimeType) {
                case MIME_PDF                          -> ocrScannedPdf(filePath);
                case MIME_PNG, MIME_JPEG, MIME_TIFF,
                     MIME_BMP                          -> ocrImage(filePath);
                default -> {
                    log.warn("OCR does not support MIME [{}]. file=[{}]",
                            mimeType, filePath.getFileName());
                    yield "";
                }
            };

            log.info("OCR completed. file=[{}], textLength={}", filePath.getFileName(), result.length());
            return CompletableFuture.completedFuture(result);

        } catch (ParsingException e) {
            throw e;
        } catch (Exception e) {
            log.warn("OCR failed. file=[{}], reason={}", filePath.getFileName(), e.getMessage());
            return CompletableFuture.completedFuture("");
        }
    }

    private String ocrScannedPdf(Path filePath) throws IOException {
        try (PDDocument document = Loader.loadPDF(filePath.toFile())) {
            int pageCount = document.getNumberOfPages();

            if (pageCount > maxPages) {
                log.warn("[SECURITY] Scanned PDF exceeds OCR page limit. pages={}, limit={}, file=[{}]",
                        pageCount, maxPages, filePath.getFileName());
                throw new ParsingException(String.format(
                        "Scanned PDF exceeds OCR page limit. pages=%d, limit=%d", pageCount, maxPages
                ), "PDF_TOO_LONG");
            }

            PDFRenderer renderer = new PDFRenderer(document);
            int maxInFlight = Math.max(1, maxParallelPages);
            List<String> pageTexts = new ArrayList<>(Collections.nCopies(pageCount, ""));
            List<CompletableFuture<PageOcrResult>> pageTasks = new ArrayList<>(maxInFlight);

            for (int i = 0; i < pageCount; i++) {
                int pageIndex = i;
                int pageNumber = i + 1;
                validateRenderedPageSize(document.getPage(pageIndex), pageNumber, filePath);
                BufferedImage image = renderer.renderImageWithDPI(pageIndex, dpi, ImageType.GRAY);
                pageTasks.add(submitPageTask(image, filePath, pageNumber));

                if (pageTasks.size() == maxInFlight) {
                    collectBatchResults(pageTasks, pageTexts);
                    pageTasks.clear();
                }
            }

            if (!pageTasks.isEmpty()) {
                collectBatchResults(pageTasks, pageTexts);
            }

            return String.join("\n", pageTexts).trim();
        }
    }

    private String ocrImage(Path filePath) {
        try {
            return buildTesseract().doOCR(filePath.toFile()).trim();
        } catch (TesseractException e) {
            log.warn("Tesseract failed on image. file=[{}], reason={}",
                    filePath.getFileName(), e.getMessage());
            return "";
        }
    }

    private void validateRenderedPageSize(PDPage page, int pageNumber, Path filePath) {
        long widthPixels = Math.round((double) page.getMediaBox().getWidth() * dpi / 72d);
        long heightPixels = Math.round((double) page.getMediaBox().getHeight() * dpi / 72d);

        if (widthPixels <= 0 || heightPixels <= 0 || widthPixels > maxRenderedPixelsPerPage / heightPixels) {
            long totalPixels = (widthPixels > 0 && heightPixels > 0 && widthPixels <= Long.MAX_VALUE / heightPixels)
                    ? widthPixels * heightPixels
                    : Long.MAX_VALUE;
            log.warn("[SECURITY] PDF page render size rejected. page={}, widthPixels={}, heightPixels={}, totalPixels={}, limit={}, file=[{}]",
                    pageNumber, widthPixels, heightPixels, totalPixels, maxRenderedPixelsPerPage, filePath.getFileName());
            throw new ParsingException(String.format(
                    "PDF page render size exceeds limit. page=%d, pixels=%d, limit=%d",
                    pageNumber, totalPixels, maxRenderedPixelsPerPage
            ), "PDF_PAGE_TOO_LARGE");
        }
    }

    private CompletableFuture<PageOcrResult> submitPageTask(BufferedImage image, Path filePath, int pageNumber) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return new PageOcrResult(pageNumber - 1, runTesseract(image, filePath, pageNumber));
            } finally {
                image.flush();
            }
        }, ocrPageExecutor);
    }

    private void collectBatchResults(List<CompletableFuture<PageOcrResult>> pageTasks, List<String> pageTexts) {
        CompletableFuture.allOf(pageTasks.toArray(new CompletableFuture[0])).join();
        for (CompletableFuture<PageOcrResult> pageTask : pageTasks) {
            PageOcrResult result = pageTask.join();
            pageTexts.set(result.pageIndex(), result.text());
        }
    }

    protected String runTesseract(BufferedImage image, Path filePath, int pageNumber) {
        try {
            return buildTesseract().doOCR(image).trim();
        } catch (TesseractException e) {
            log.warn("Tesseract failed on page {}. file=[{}], reason={}",
                    pageNumber, filePath.getFileName(), e.getMessage());
            return "";
        }
    }

    private record PageOcrResult(int pageIndex, String text) {
    }

    private ITesseract buildTesseract() {
        ITesseract tesseract = new Tesseract();
        tesseract.setDatapath(tessdataPath);
        tesseract.setLanguage(language);
        tesseract.setPageSegMode(1);
        return tesseract;
    }
}
