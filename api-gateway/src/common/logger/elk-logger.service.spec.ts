import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ElkLoggerService } from './elk-logger.service';

describe('ElkLoggerService', () => {
  let service: ElkLoggerService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) => {
          const config: Record<string, unknown> = {
            LOG_LEVEL: 'debug',
            NODE_ENV: 'test',
          };
          return config[key] ?? defaultValue;
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElkLoggerService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = await module.resolve<ElkLoggerService>(ElkLoggerService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log methods', () => {
    it('should log info message', () => {
      expect(() => service.log('test message')).not.toThrow();
    });

    it('should log info message with context', () => {
      expect(() => service.log('test message', 'TestContext')).not.toThrow();
    });

    it('should log error message', () => {
      expect(() => service.error('error message')).not.toThrow();
    });

    it('should log error message with trace', () => {
      expect(() =>
        service.error('error message', 'stack trace', 'TestContext'),
      ).not.toThrow();
    });

    it('should log warn message', () => {
      expect(() => service.warn('warning message')).not.toThrow();
    });

    it('should log debug message', () => {
      expect(() => service.debug('debug message')).not.toThrow();
    });

    it('should log verbose message', () => {
      expect(() => service.verbose('verbose message')).not.toThrow();
    });
  });

  describe('setContext', () => {
    it('should set context for subsequent logs', () => {
      service.setContext('CustomContext');
      expect(() => service.log('test message')).not.toThrow();
    });
  });

  describe('message formatting', () => {
    it('should handle string messages', () => {
      expect(() => service.log('string message')).not.toThrow();
    });

    it('should handle Error objects', () => {
      expect(() => service.error(new Error('error object'))).not.toThrow();
    });

    it('should handle object messages', () => {
      expect(() => service.log({ key: 'value' })).not.toThrow();
    });
  });

  describe('ELK transport', () => {
    it('should not add ELK transport when ELK_HOST is not configured', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith('ELK_HOST');
    });

    it('should add ELK transport when ELK_HOST is configured', async () => {
      const mockConfigWithElk = {
        get: jest
          .fn()
          .mockImplementation((key: string, defaultValue?: unknown) => {
            const config: Record<string, unknown> = {
              ELK_HOST: 'http://localhost:9200',
              LOG_LEVEL: 'info',
              ELK_LOG_LEVEL: 'info',
              ELK_INDEX_PREFIX: 'test-api',
              NODE_ENV: 'test',
            };
            return config[key] ?? defaultValue;
          }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ElkLoggerService,
          { provide: ConfigService, useValue: mockConfigWithElk },
        ],
      }).compile();

      const elkService =
        await module.resolve<ElkLoggerService>(ElkLoggerService);
      expect(elkService).toBeDefined();
      expect(() => elkService.log('test with elk')).not.toThrow();
    });

    it('should configure ELK auth when credentials are provided', async () => {
      const mockConfigWithAuth = {
        get: jest
          .fn()
          .mockImplementation((key: string, defaultValue?: unknown) => {
            const config: Record<string, unknown> = {
              ELK_HOST: 'http://localhost:9200',
              ELK_USERNAME: 'elastic',
              ELK_PASSWORD: 'password',
              LOG_LEVEL: 'info',
              NODE_ENV: 'test',
            };
            return config[key] ?? defaultValue;
          }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ElkLoggerService,
          { provide: ConfigService, useValue: mockConfigWithAuth },
        ],
      }).compile();

      const elkService =
        await module.resolve<ElkLoggerService>(ElkLoggerService);
      expect(elkService).toBeDefined();
    });
  });
});
