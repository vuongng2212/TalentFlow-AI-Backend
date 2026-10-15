import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { InvoiceStorageService } from './invoice-storage.service';

describe('InvoiceStorageService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stores a PDF under one deterministic private key with its content hash', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({});
    const config = {
      getOrThrow: jest.fn().mockReturnValue('payment-private'),
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'R2_ENDPOINT') return 'http://localhost:9000';
        if (key === 'R2_ACCESS_KEY_ID') return 'access';
        if (key === 'R2_SECRET_ACCESS_KEY') return 'secret';
        if (key === 'MOMO_REQUEST_TIMEOUT_MS') return 30000;
        return fallback;
      }),
    } as unknown as ConfigService;
    const service = new InvoiceStorageService(config);
    const content = Buffer.from('%PDF-test');

    await expect(service.putReceipt('TFI_1', content)).resolves.toEqual({
      bucket: 'payment-private',
      key: 'invoices/TFI_1.pdf',
      contentSha256: createHash('sha256').update(content).digest('hex'),
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('creates a bounded signed GET URL rather than exposing a permanent object URL', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-18T00:00:00.000Z') });
    const config = {
      getOrThrow: jest.fn().mockReturnValue('payment-private'),
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'R2_ENDPOINT') return 'http://localhost:9000';
        if (key === 'R2_ACCESS_KEY_ID') return 'access';
        if (key === 'R2_SECRET_ACCESS_KEY') return 'secret';
        if (key === 'PAYMENT_INVOICE_URL_TTL_SEC') return 300;
        if (key === 'MOMO_REQUEST_TIMEOUT_MS') return 30000;
        return fallback;
      }),
    } as unknown as ConfigService;
    const service = new InvoiceStorageService(config);

    const result = await service.createDownloadUrl('invoices/TFI_1.pdf');

    expect(result.url).toContain('X-Amz-Signature=');
    expect(result.url).not.toBe('http://localhost:9000/invoices/TFI_1.pdf');
    expect(result.expiresAt).toEqual(new Date('2026-09-18T00:05:00.000Z'));
    await service.onModuleDestroy();
    jest.useRealTimers();
  });
});
