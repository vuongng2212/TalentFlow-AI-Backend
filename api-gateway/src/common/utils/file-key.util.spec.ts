import { generateCvFileKey } from './file-key.util';

describe('generateCvFileKey', () => {
  it('should generate key with pdf extension', () => {
    const key = generateCvFileKey('resume.pdf');

    expect(key).toMatch(/^cvs\/[0-9a-f-]{36}\.pdf$/);
  });

  it('should generate key with docx extension', () => {
    const key = generateCvFileKey('resume.docx');

    expect(key).toMatch(/^cvs\/[0-9a-f-]{36}\.docx$/);
  });

  it('should fallback to pdf for invalid extension', () => {
    const key = generateCvFileKey('resume.exe');

    expect(key).toMatch(/^cvs\/[0-9a-f-]{36}\.pdf$/);
  });

  it('should fallback to pdf when no extension', () => {
    const key = generateCvFileKey('resume');

    expect(key).toMatch(/^cvs\/[0-9a-f-]{36}\.pdf$/);
  });
});
