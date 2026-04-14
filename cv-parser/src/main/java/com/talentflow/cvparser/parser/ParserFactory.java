package com.talentflow.cvparser.parser;

import com.talentflow.cvparser.shared.exception.ParsingException;
import com.talentflow.cvparser.shared.exception.UnsupportedDocumentFormatException;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class ParserFactory {

    private static final Tika TIKA = new Tika();

    @Value("${app.ocr.min-text-length-threshold:100}")
    private int minTextLengthThreshold;

    @Value("${app.parser.ocr-timeout-seconds:120}")
    private long ocrTimeoutSeconds;

    private final List<DocumentParser> parsers;
    private final TesseractOcrImpl ocrImageParser;

    public ParserFactory(List<DocumentParser> parsers, TesseractOcrImpl ocrImageParser) {
        this.parsers = parsers;
        this.ocrImageParser = ocrImageParser;
    }

    @PostConstruct
    public void init() {
        log.info("Initialized ParserFactory. parsers={}, minTextLengthThreshold={}, ocrTimeoutSeconds={}",
                parsers.stream().map(p -> p.getClass().getSimpleName()).toList(),
                minTextLengthThreshold,
                ocrTimeoutSeconds);
    }

    /**
     * Parse file CV: detect MIME → route parser → OCR fallback nếu text < threshold.
     *
     * @param filePath Path tới TempFile đã download từ S3
     * @return Raw text — không null, có thể empty string
     * @throws UnsupportedDocumentFormatException nếu MIME type không được hỗ trợ
     * @throws ParsingException                   nếu parse thất bại
     * @throws IOException                        nếu Tika không đọc được file
     */
    public String parse(Path filePath) throws IOException {

        String mimeType = TIKA.detect(filePath.toFile());
        log.info("Detected MIME type [{}] for file [{}]", mimeType, filePath.getFileName());

        DocumentParser parser = parsers.stream()
                .filter(p -> p.supports(mimeType))
                .findFirst()
                .orElseThrow(() -> {
                    log.warn("[SECURITY] Unsupported MIME type rejected. mime=[{}], file=[{}]",
                            mimeType, filePath.getFileName());
                    return new UnsupportedDocumentFormatException(
                            "Unsupported document format: [" + mimeType + "]. Only PDF and DOCX are accepted."
                    );
                });

        String text = parser.parse(filePath);
        log.debug("Parser [{}] extracted {} chars from [{}]",
                parser.getClass().getSimpleName(), text.length(), filePath.getFileName());

        if (text.length() < minTextLengthThreshold) {
            log.info("Text too short ({} chars < {}), triggering OCR fallback. file=[{}]",
                    text.length(), minTextLengthThreshold, filePath.getFileName());
            text = runOcrWithTimeout(filePath);
        }

        return text;
    }

    private String runOcrWithTimeout(Path filePath) {
        try {
            CompletableFuture<String> future = ocrImageParser.extractText(filePath);

            String ocrText = future.get(ocrTimeoutSeconds, TimeUnit.SECONDS);
            log.info("OCR fallback extracted {} chars. file=[{}]", ocrText.length(), filePath.getFileName());
            return ocrText;

        } catch (java.util.concurrent.TimeoutException e) {
            log.warn("OCR timeout after {}s. file=[{}] — continuing with empty text",
                    ocrTimeoutSeconds, filePath.getFileName());
            return "";
        } catch (Exception e) {
            log.warn("OCR fallback failed. file=[{}], reason={} — continuing with empty text",
                    filePath.getFileName(), e.getMessage());
            return "";
        }
    }
}
