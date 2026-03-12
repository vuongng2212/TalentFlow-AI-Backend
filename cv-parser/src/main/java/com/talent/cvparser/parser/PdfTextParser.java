package com.talent.cvparser.parser;

import com.talent.cvparser.shared.exception.ParsingException;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;

@Slf4j
@Component
public class PdfTextParser implements DocumentParser {

    private static final String SUPPORTED_MIME = "application/pdf";
    private static final int MAX_PAGES = 10;

    @Override
    public String parse(Path filePath) throws ParsingException {
        log.debug("Parsing PDF file: [{}]", filePath);


        try (PDDocument document = Loader.loadPDF(filePath.toFile())) {

            int pageCount = document.getNumberOfPages();
            if (pageCount > MAX_PAGES) {
                log.warn("[SECURITY] PDF Bomb attempt rejected. pages={}, limit={}, file=[{}]",
                        pageCount, MAX_PAGES, filePath);
                throw new ParsingException(String.format(
                        "PDF exceeds maximum page limit. pages=%d, limit=%d", pageCount, MAX_PAGES
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