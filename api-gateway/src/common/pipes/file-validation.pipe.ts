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

    const mimetype = file.mimetype;
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF and DOCX files are allowed',
      );
    }

    const originalname = file.originalname;
    const extension = originalname.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      throw new BadRequestException(
        'Invalid file extension. Only .pdf and .docx files are allowed',
      );
    }

    this.validateFileSignature(file, extension);

    const fileSize = file.size;
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    return file;
  }

  private validateFileSignature(
    file: Express.Multer.File,
    extension: string,
  ): void {
    const buffer = file.buffer;
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Unable to validate file content');
    }

    if (extension === 'pdf' && !this.hasSignature(buffer, PDF_SIGNATURE)) {
      throw new BadRequestException('Invalid PDF file signature');
    }

    if (
      extension === 'docx' &&
      !ZIP_SIGNATURES.some((signature) => this.hasSignature(buffer, signature))
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
