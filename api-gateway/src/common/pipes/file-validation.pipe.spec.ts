import { BadRequestException } from '@nestjs/common';
import { FileValidationPipe } from './file-validation.pipe';

describe('FileValidationPipe', () => {
  let pipe: FileValidationPipe;

  beforeEach(() => {
    pipe = new FileValidationPipe();
  });

  it('should validate PDF file', () => {
    const file = {
      mimetype: 'application/pdf',
      originalname: 'resume.pdf',
      size: 1024,
      buffer: Buffer.from('%PDF-1.7\ncontent'),
    } as Express.Multer.File;

    expect(pipe.transform(file)).toBe(file);
  });

  it('should validate DOCX file', () => {
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      originalname: 'resume.docx',
      size: 1024,
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    } as Express.Multer.File;

    expect(pipe.transform(file)).toBe(file);
  });

  it('should throw when file is missing', () => {
    expect(() =>
      pipe.transform(undefined as unknown as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it('should throw for invalid MIME type', () => {
    const file = {
      mimetype: 'image/png',
      originalname: 'resume.png',
      size: 1024,
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('should throw for invalid file extension', () => {
    const file = {
      mimetype: 'application/pdf',
      originalname: 'resume.exe',
      size: 1024,
      buffer: Buffer.from('%PDF-1.7\ncontent'),
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('should throw for invalid PDF signature', () => {
    const file = {
      mimetype: 'application/pdf',
      originalname: 'resume.pdf',
      size: 1024,
      buffer: Buffer.from('not-a-pdf'),
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('should throw for invalid DOCX signature', () => {
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      originalname: 'resume.docx',
      size: 1024,
      buffer: Buffer.from('%PDF-1.7\ncontent'),
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('should throw when file buffer is empty', () => {
    const file = {
      mimetype: 'application/pdf',
      originalname: 'resume.pdf',
      size: 1024,
      buffer: Buffer.alloc(0),
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('should throw when file size exceeds 10MB', () => {
    const file = {
      mimetype: 'application/pdf',
      originalname: 'resume.pdf',
      size: 10 * 1024 * 1024 + 1,
      buffer: Buffer.from('%PDF-1.7\ncontent'),
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });
});
