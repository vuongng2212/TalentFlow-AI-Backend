package com.talent.cvparser.parser;

import com.talent.cvparser.shared.exception.ParsingException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;

@Slf4j
@Component
public class PdfTextParser implements DocumentParser {

    private static final String SUPPORTED_MIME = "application/pdf";

    @Value("${app.parser.pdf.max-pages:10}")
    private int maxPages;

    @PostConstruct
    public void init() {
        log.info("Initialized PdfTextParser. maxPages={}", maxPages);
    }

    @Override
    public String parse(Path filePath) throws ParsingException {
        try (PDDocument document = Loader.loadPDF(filePath.toFile())) {
            int pageCount = document.getNumberOfPages();
            if (pageCount > maxPages) {
                log.warn("[SECURITY] PDF Bomb rejected. pages={}, limit={}, file=[{}]",
                        pageCount, maxPages, filePath);
                throw new ParsingException(String.format(
                        "PDF exceeds maximum page limit. pages=%d, limit=%d", pageCount, maxPages
                ));
            }
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            log.info("PDF parsed successfully. pages={}, textLength={}, file=[{}]",
                    pageCount, text.length(), filePath);
            return text != null ? text.trim() : "";
        } catch (ParsingException e) {
            throw e;
        } catch (IOException e) {
            throw new ParsingException(
                    "Failed to parse PDF file: [" + filePath.getFileName() + "]", e
            );
        }
    }

    @Override
    public boolean supports(String mimeType) {
        return SUPPORTED_MIME.equalsIgnoreCase(mimeType);
    }
}