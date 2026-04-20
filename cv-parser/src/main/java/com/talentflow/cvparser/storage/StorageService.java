package com.talentflow.cvparser.storage;

import java.io.IOException;
import java.nio.file.Path;

public interface StorageService {

    /**
     * Download an toàn về TempFile. Caller PHẢI xóa file sau khi dùng.
     *
     * @param fileKey S3 object key (path) đã được validate
     * @return Path tới TempFile đã download
     * @throws IllegalArgumentException nếu fileKey không hợp lệ
     * @throws com.talentflow.cvparser.shared.exception.StorageObjectNotFoundException nếu object không tồn tại
     * @throws com.talentflow.cvparser.shared.exception.PayloadTooLargeException nếu file vượt giới hạn
     * @throws IOException nếu lỗi I/O khi stream
     */
    Path downloadSafely(String fileKey) throws IOException;
}
