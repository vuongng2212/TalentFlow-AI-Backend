package com.talent.cvparser.storage;

import java.io.IOException;
import java.nio.file.Path;

public interface StorageService {
    /**
     * Download an toàn về TempFile. Caller PHẢI xóa file sau khi dùng.
     * @throws InvalidStorageKeyException nếu objectKey bất thường
     * @throws PayloadTooLargeException nếu file vượt giới hạn
     * @throws IOException nếu lỗi I/O khi stream
     */
    Path downloadSafely(String objectKey) throws IOException;
}
