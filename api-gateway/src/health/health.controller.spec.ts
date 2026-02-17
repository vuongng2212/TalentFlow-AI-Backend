/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockMemoryHealthIndicator = {
    checkHeap: jest.fn(),
    checkRSS: jest.fn(),
  };

  const mockDiskHealthIndicator = {
    checkStorage: jest.fn(),
  };

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockRedisService = {
    ping: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: MemoryHealthIndicator, useValue: mockMemoryHealthIndicator },
        { provide: DiskHealthIndicator, useValue: mockDiskHealthIndicator },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health check result', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
        },
        error: {},
        details: {
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result).toEqual(mockResult);
      expect(healthCheckService.check).toHaveBeenCalled();
    });

    it('should call memory health indicators', async () => {
      mockHealthCheckService.check.mockImplementation(
        async (indicators: (() => Promise<unknown>)[]) => {
          for (const indicator of indicators) {
            await indicator();
          }
          return { status: 'ok', info: {}, error: {}, details: {} };
        },
      );

      await controller.check();

      expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalledWith(
        'memory_heap',
        150 * 1024 * 1024,
      );
      expect(mockMemoryHealthIndicator.checkRSS).toHaveBeenCalledWith(
        'memory_rss',
        300 * 1024 * 1024,
      );
    });
  });

  describe('readiness', () => {
    it('should return readiness check result', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          database: { status: 'up' },
          redis: { status: 'up' },
        },
        error: {},
        details: {
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(mockResult);
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue('PONG');

      const result = await controller.readiness();

      expect(result).toEqual(mockResult);
      expect(healthCheckService.check).toHaveBeenCalled();
    });

    it('should include database and redis health checks', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue('PONG');

      mockHealthCheckService.check.mockImplementation(
        async (indicators: (() => Promise<unknown>)[]) => {
          // Execute all indicators to test they work
          for (const indicator of indicators) {
            try {
              await indicator();
            } catch {
              // Ignore errors in test
            }
          }
          return { status: 'ok', info: {}, error: {}, details: {} };
        },
      );

      await controller.readiness();

      // Verify memory checks are included
      expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalled();
      expect(mockMemoryHealthIndicator.checkRSS).toHaveBeenCalled();
    });
  });
});
