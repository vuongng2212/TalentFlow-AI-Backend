import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

const mockSend = jest.fn();
const mockDestroy = jest.fn();

const mockGetSignedUrl = jest.fn();

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
  getSignedUrl: (...args: unknown[]): unknown => mockGetSignedUrl(...args),
}));

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

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
    expect(mockGetSignedUrl).toHaveBeenCalled();
  });

  it('should generate signed url with custom expiry', async () => {
    await service.getSignedUrl('cvs/file.pdf', 120);

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      { expiresIn: 120 },
    );
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

  it('should build file url from public URL when provided', async () => {
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
                R2_PUBLIC_URL: 'https://cdn.example.com',
                R2_ACCESS_KEY_ID: 'minioadmin',
                R2_SECRET_ACCESS_KEY: 'minioadmin',
              };
              return values[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    const localService = module.get<StorageService>(StorageService);
    mockSend.mockResolvedValue({});

    const result = await localService.upload(
      Buffer.from('test'),
      'cvs/file.pdf',
      'application/pdf',
    );

    expect(result.url).toBe('https://cdn.example.com/cvs/file.pdf');
  });

  it('should fallback endpoint to account-based R2 URL', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const values: Record<string, string | null> = {
                R2_ENDPOINT: null,
                R2_ACCOUNT_ID: 'acc123',
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

    const localService = module.get<StorageService>(StorageService);
    mockSend.mockResolvedValue({});

    const result = await localService.upload(
      Buffer.from('test'),
      'cvs/file.pdf',
      'application/pdf',
    );

    expect(result.url).toBe(
      'https://acc123.r2.cloudflarestorage.com/talentflow-cvs/cvs/file.pdf',
    );
  });

  it('should fallback endpoint to localhost when endpoint and account are missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const values: Record<string, string | null> = {
                R2_ENDPOINT: null,
                R2_ACCOUNT_ID: null,
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

    const localService = module.get<StorageService>(StorageService);
    mockSend.mockResolvedValue({});

    const result = await localService.upload(
      Buffer.from('test'),
      'cvs/file.pdf',
      'application/pdf',
    );

    expect(result.url).toBe(
      'http://localhost:9000/talentflow-cvs/cvs/file.pdf',
    );
  });

  it('should initialize without credentials when keys are missing', async () => {
    await expect(
      Test.createTestingModule({
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
                  R2_ACCESS_KEY_ID: null,
                  R2_SECRET_ACCESS_KEY: null,
                };
                return values[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile(),
    ).resolves.toBeDefined();
  });
});
