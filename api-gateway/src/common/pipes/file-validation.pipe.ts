import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['pdf', 'docx'];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const PDF_SIGNATURE = Buffer.from('%PDF-');
const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];

@Injectable()
export class FileValidationPipe implements PipeTransform {
  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF and DOCX files are allowed',
      );
    }

    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      throw new BadRequestException(
        'Invalid file extension. Only .pdf and .docx files are allowed',
      );
    }

    this.validateFileSignature(file, extension);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    return file;
  }

  private validateFileSignature(
    file: Express.Multer.File,
    extension: string,
  ): void {
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Unable to validate file content');
    }

    if (extension === 'pdf' && !this.hasSignature(file.buffer, PDF_SIGNATURE)) {
      throw new BadRequestException('Invalid PDF file signature');
    }

    if (
      extension === 'docx' &&
      !ZIP_SIGNATURES.some((signature) =>
        this.hasSignature(file.buffer, signature),
      )
    ) {
      throw new BadRequestException('Invalid DOCX file signature');
    }
  }

  private hasSignature(buffer: Buffer, signature: Buffer): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    return signature.every((byte, index) => buffer[index] === byte);
  }
}
