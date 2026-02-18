/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { QueueService } from '../queue/queue.service';

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

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockRedisService = {
    ping: jest.fn(),
  };

  const mockQueueService = {
    isHealthy: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: MemoryHealthIndicator, useValue: mockMemoryHealthIndicator },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: QueueService, useValue: mockQueueService },
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
          queue: { status: 'up' },
        },
        error: {},
        details: {
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          database: { status: 'up' },
          redis: { status: 'up' },
          queue: { status: 'up' },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(mockResult);
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue('PONG');
      mockQueueService.isHealthy.mockResolvedValue(true);

      const result = await controller.readiness();

      expect(result).toEqual(mockResult);
      expect(healthCheckService.check).toHaveBeenCalled();
    });

    it('should include database, redis, and queue health checks', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue('PONG');
      mockQueueService.isHealthy.mockResolvedValue(true);

      mockHealthCheckService.check.mockImplementation(
        async (indicators: (() => Promise<unknown>)[]) => {
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

      expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalled();
      expect(mockMemoryHealthIndicator.checkRSS).toHaveBeenCalled();
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(mockRedisService.ping).toHaveBeenCalled();
      expect(mockQueueService.isHealthy).toHaveBeenCalled();
    });

    it('should propagate readiness failures from dependency indicators', async () => {
      mockHealthCheckService.check.mockImplementation(
        async (indicators: (() => Promise<unknown>)[]) => {
          for (const indicator of indicators) {
            await indicator();
          }
          return { status: 'ok', info: {}, error: {}, details: {} };
        },
      );
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('db unavailable'),
      );
      mockRedisService.ping.mockResolvedValue('PONG');
      mockQueueService.isHealthy.mockResolvedValue(true);

      await expect(controller.readiness()).rejects.toThrow('Prisma check failed');
    });

    it('should fail when redis does not return PONG', async () => {
      mockHealthCheckService.check.mockImplementation(
        async (indicators: (() => Promise<unknown>)[]) => {
          for (const indicator of indicators) {
            await indicator();
          }
          return { status: 'ok', info: {}, error: {}, details: {} };
        },
      );
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue('NOT_PONG');
      mockQueueService.isHealthy.mockResolvedValue(true);

      await expect(controller.readiness()).rejects.toThrow('Redis check failed');
    });

    it('should fail when queue is unhealthy', async () => {
      mockHealthCheckService.check.mockImplementation(
        async (indicators: (() => Promise<unknown>)[]) => {
          for (const indicator of indicators) {
            await indicator();
          }
          return { status: 'ok', info: {}, error: {}, details: {} };
        },
      );
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue('PONG');
      mockQueueService.isHealthy.mockResolvedValue(false);

      await expect(controller.readiness()).rejects.toThrow(
        'RabbitMQ check failed',
      );
    });
  });
});
