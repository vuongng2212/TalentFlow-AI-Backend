import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadResult {
  key: string;
  url: string;
}

@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string | null;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.getEndpoint();
    this.bucketName = this.configService.get<string>(
      'R2_BUCKET',
      'talentflow-cvs',
    );
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') || null;

    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );

    const hasCredentials = Boolean(accessKeyId && secretAccessKey);
    const timeoutMs = this.configService.get<number>('TIMEOUT_MS', 15000);

    const s3Config: S3ClientConfig = {
      region: 'auto',
      endpoint,
      forcePathStyle: true,
      requestHandler: {
        requestTimeout: timeoutMs,
      },
    };

    if (hasCredentials && accessKeyId && secretAccessKey) {
      s3Config.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    this.client = new S3Client(s3Config);

    this.logger.log(`Storage initialized with bucket: ${this.bucketName}`);
  }

  private getEndpoint(): string {
    const customEndpoint = this.configService.get<string>('R2_ENDPOINT');
    if (customEndpoint) {
      return customEndpoint;
    }

    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    if (accountId) {
      return `https://${accountId}.r2.cloudflarestorage.com`;
    }

    return 'http://localhost:9000';
  }

  async upload(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);

    const url = this.buildFileUrl(key);
    this.logger.log(`File uploaded: ${key}`);

    return { key, url };
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);
    this.logger.log(`File deleted: ${key}`);
  }

  private buildFileUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }

    const endpoint = this.getEndpoint();
    return `${endpoint}/${this.bucketName}/${key}`;
  }

  onModuleDestroy(): Promise<void> {
    this.client.destroy();
    this.logger.log('Storage client destroyed');
    return Promise.resolve();
  }
}
