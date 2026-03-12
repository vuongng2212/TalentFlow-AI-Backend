package com.talent.cvparser.parser;

import com.talent.cvparser.shared.exception.ParsingException;

import java.nio.file.Path;

public interface DocumentParser {

    /**
     * Trích xuất raw text từ file CV.
     *
     * @param filePath Path tới temp file đã được download từ S3
     * @return Raw text trích xuất được — không bao giờ null, có thể empty string
     * @throws ParsingException nếu file corrupt, quá giới hạn, hoặc chứa payload độc hại
     */
    String parse(Path filePath) throws ParsingException;

    /**
     * Khai báo MIME type mà parser này hỗ trợ.
     * ParserFactory dùng method này để routing đúng parser.
     *
     * @param mimeType MIME type detect từ Apache Tika (magic bytes)
     * @return true nếu parser này xử lý được mimeType đó
     */
    boolean supports(String mimeType);
}
