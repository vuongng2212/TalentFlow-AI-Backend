import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'node:crypto';

export interface StoredInvoiceDocument {
  bucket: string;
  key: string;
  contentSha256: string;
}

@Injectable()
export class InvoiceStorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('PAYMENT_INVOICE_BUCKET');
    const endpoint = this.resolveEndpoint();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: true,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
      requestHandler: {
        requestTimeout: this.config.get<number>(
          'MOMO_REQUEST_TIMEOUT_MS',
          30000,
        ),
      },
    });
  }

  async putReceipt(
    invoiceReference: string,
    content: Buffer,
  ): Promise<StoredInvoiceDocument> {
    const key = `invoices/${invoiceReference}.pdf`;
    const contentSha256 = createHash('sha256').update(content).digest('hex');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: 'application/pdf',
        Metadata: { contentSha256 },
      }),
    );
    return { bucket: this.bucket, key, contentSha256 };
  }

  async createDownloadUrl(
    storageKey: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const ttlSeconds = this.config.get<number>(
      'PAYMENT_INVOICE_URL_TTL_SEC',
      300,
    );
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: ttlSeconds },
    );
    return { url, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  onModuleDestroy(): Promise<void> {
    this.client.destroy();
    return Promise.resolve();
  }

  private resolveEndpoint(): string {
    const configured = this.config.get<string>('R2_ENDPOINT');
    if (configured) {
      return configured;
    }
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    if (accountId) {
      return `https://${accountId}.r2.cloudflarestorage.com`;
    }
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new Error(
        'Private invoice storage requires R2_ENDPOINT or R2_ACCOUNT_ID',
      );
    }
    return 'http://localhost:9000';
  }
}
