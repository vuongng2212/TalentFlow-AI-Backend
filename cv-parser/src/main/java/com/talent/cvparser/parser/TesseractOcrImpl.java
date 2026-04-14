package com.talent.cvparser.parser;

import com.talent.cvparser.shared.exception.ParsingException;
import lombok.extern.slf4j.Slf4j;
import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
public class TesseractOcrImpl {

    private static final String MIME_PDF  = "application/pdf";
    private static final String MIME_PNG  = "image/png";
    private static final String MIME_JPEG = "image/jpeg";
    private static final String MIME_TIFF = "image/tiff";
    private static final String MIME_BMP  = "image/bmp";

    @Value("${app.ocr.tessdata-path:/usr/share/tesseract-ocr/4.00/tessdata}")
    private String tessdataPath;

    @Value("${app.ocr.language:vie+eng}")
    private String language;

    @Value("${app.ocr.dpi:300}")
    private int dpi;

    @Value("${app.ocr.max-pages:20}")
    private int maxPages;

    @Value("${app.ocr.min-text-length-threshold:100}")
    int minTextLengthThreshold;

    @PostConstruct
    public void init() {
        log.info("Initialized OcrImageParser. maxPages={}, dpi={}, language={}, tessdataPath={}",
                maxPages, dpi, language, tessdataPath);
    }

    @Async("ocrTaskExecutor")
    public CompletableFuture<String> extractText(Path filePath) {
        log.info("OCR started. file=[{}], thread=[{}]",
                filePath.getFileName(), Thread.currentThread().getName());
        try {
            String mimeType = new Tika().detect(filePath.toFile());
            String result   = switch (mimeType) {
                case MIME_PDF                           -> ocrScannedPdf(filePath);
                case MIME_PNG, MIME_JPEG, MIME_TIFF,
                     MIME_BMP                           -> ocrImage(filePath);
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
                ));
            }

            PDFRenderer renderer = new PDFRenderer(document);
            List<String> pageTexts = new ArrayList<>();
            for (int i = 0; i < pageCount; i++) {
                BufferedImage image = renderer.renderImageWithDPI(i, dpi, ImageType.GRAY);
                pageTexts.add(runTesseract(image, filePath, i + 1));
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

    private String runTesseract(BufferedImage image, Path filePath, int pageNumber) {
        try {
            return buildTesseract().doOCR(image).trim();
        } catch (TesseractException e) {
            log.warn("Tesseract failed on page {}. file=[{}], reason={}",
                    pageNumber, filePath.getFileName(), e.getMessage());
            return "";
        }
    }

    private ITesseract buildTesseract() {
        ITesseract tesseract = new Tesseract();
        tesseract.setDatapath(tessdataPath);
        tesseract.setLanguage(language);
        tesseract.setPageSegMode(1);
        return tesseract;
    }
}
