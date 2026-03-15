package com.talent.cvparser.parser;

import com.talent.cvparser.shared.exception.DocumentTooLongException;
import com.talent.cvparser.shared.exception.ParsingException;
import com.talent.cvparser.shared.exception.UnsupportedDocumentFormatException;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.openxml4j.exceptions.NotOfficeXmlFileException;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Path;

@Slf4j
@Component
public class DocxTextParser implements DocumentParser{

    @Value("${app.parser.docx.min-inflate-ratio:0.01}")
    private double minInflateRatio;

    @Value("${app.parser.docx.max-entry-size:20971520}")
    private long maxEntrySize;

    @Value("${app.parser.docx.max-text-size:2000000}")
    private long maxTextSize;

    @PostConstruct
    public void init() {
        ZipSecureFile.setMinInflateRatio(minInflateRatio);
        ZipSecureFile.setMaxEntrySize(maxEntrySize);
        ZipSecureFile.setMaxTextSize(maxTextSize);
        log.info("Initialized DocxTextParser with security limits: ratio={}, entrySize={}, textSize={}", 
                minInflateRatio, maxEntrySize, maxTextSize);
    }

    @Override
    public boolean supports(String mimeType) {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equalsIgnoreCase(mimeType);
    }

    @Override
    public String parse(Path filePath) throws ParsingException {
        log.info("Starting DOCX parsing for file: {}", filePath.getFileName());

        try (OPCPackage pkg = OPCPackage.open(filePath.toFile());
             XWPFDocument document = new XWPFDocument(pkg);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {

            String parsedText = extractor.getText();

            if (parsedText != null && parsedText.length() > ZipSecureFile.getMaxTextSize()) {
                throw new DocumentTooLongException("CV file contains too much text (Exceeds 2 million characters).");
            }

            return parsedText != null ? parsedText.trim() : "";

        } catch (NotOfficeXmlFileException e) {
            log.warn("Rejected old OLE2 format disguised as DOCX: {}", filePath.getFileName());
            throw new UnsupportedDocumentFormatException("Vui lòng lưu CV dưới định dạng .docx (Word 2007+) thay vì định dạng .doc cũ.");
        } catch (InvalidFormatException e) {
            log.error("Invalid DOCX format or Zip Bomb detected: {}", filePath.getFileName(), e);
            throw new ParsingException("File CV bị hỏng hoặc chứa cấu trúc nguy hiểm.", e);
        } catch (IOException e) {
            log.error("I/O Error while parsing DOCX: {}", filePath.getFileName(), e);
            throw new ParsingException("Lỗi đọc file DOCX trên hệ thống.", e);
        } catch (Exception e) {
            log.error("Unexpected error during DOCX extraction: {}", filePath.getFileName(), e);
            throw new ParsingException("Lỗi không xác định khi xử lý file CV.", e);
        }
    }
}