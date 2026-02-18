import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

const mockSend = jest.fn();
const mockDestroy = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
      destroy: mockDestroy,
    })),
    PutObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
}));

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const values: Record<string, string | null> = {
                R2_ENDPOINT: 'http://localhost:9000',
                R2_BUCKET: 'talentflow-cvs',
                R2_PUBLIC_URL: null,
                R2_ACCESS_KEY_ID: 'minioadmin',
                R2_SECRET_ACCESS_KEY: 'minioadmin',
              };
              return values[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should upload file and return key + url', async () => {
    mockSend.mockResolvedValue({});

    const result = await service.upload(
      Buffer.from('test'),
      'cvs/file.pdf',
      'application/pdf',
    );

    expect(mockSend).toHaveBeenCalled();
    expect(result).toEqual({
      key: 'cvs/file.pdf',
      url: 'http://localhost:9000/talentflow-cvs/cvs/file.pdf',
    });
  });

  it('should generate signed url', async () => {
    const result = await service.getSignedUrl('cvs/file.pdf');

    expect(result).toBe('https://signed-url.example.com');
  });

  it('should delete file', async () => {
    mockSend.mockResolvedValue({});

    await service.delete('cvs/file.pdf');

    expect(mockSend).toHaveBeenCalled();
  });

  it('should destroy client on module destroy', async () => {
    await service.onModuleDestroy();

    expect(mockDestroy).toHaveBeenCalled();
  });
});
