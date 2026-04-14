package com.talent.cvparser.usecase;

import com.talent.cvparser.listener.CvUploadEvent;

public interface CvParsingUseCase {

    /**
     * Thực thi toàn bộ pipeline:
     * Download → Parse → OCR fallback → LLM Extract → Persist → Publish.
     *
     * TempFile cleanup là trách nhiệm của UseCase — Listener không biết
     * và không cần biết file nằm ở đâu.
     *
     * @param event Message từ cv.upload.queue
     * @throws Exception nếu bất kỳ bước nào thất bại không thể recover —
     *                   Listener sẽ bắt và NACK sang DLQ.
     */
    void execute(CvUploadEvent event) throws Exception;
}