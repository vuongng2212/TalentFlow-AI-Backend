import { randomUUID } from 'crypto';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx']);

export function generateCvFileKey(originalName: string): string {
  const parts = originalName.split('.');
  const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
  const safeExtension =
    extension && ALLOWED_EXTENSIONS.has(extension) ? extension : 'pdf';

  return `cvs/${randomUUID()}.${safeExtension}`;
}
