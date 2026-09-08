import { HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitmqHealthIndicator } from './rabbitmq.health';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let prismaService: jest.Mocked<PrismaService>;
  let rabbitmqHealthIndicator: jest.Mocked<RabbitmqHealthIndicator>;

  beforeEach(() => {
    healthCheckService = {
      check: jest
        .fn()
        .mockImplementation(
          async (checks: Array<() => Promise<HealthIndicatorResult>>) => {
            for (const check of checks) {
              await check();
            }
            return { status: 'ok', info: {}, error: {}, details: {} };
          },
        ),
    } as unknown as jest.Mocked<HealthCheckService>;

    prismaService = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as jest.Mocked<PrismaService>;

    rabbitmqHealthIndicator = {
      isHealthy: jest.fn().mockResolvedValue({ rabbitmq: { status: 'up' } }),
    } as unknown as jest.Mocked<RabbitmqHealthIndicator>;

    controller = new HealthController(
      healthCheckService,
      prismaService,
      rabbitmqHealthIndicator,
    );
  });

  it('should return ok for liveness', () => {
    expect(controller.liveness()).toEqual({ status: 'ok' });
  });

  it('should return ok when all readiness checks pass', async () => {
    const result = await controller.readiness();
    expect(result).toEqual({ status: 'ok' });
  });

  it('should return ok for root health check', async () => {
    const result = await controller.check();
    expect(result).toEqual({ status: 'ok' });
  });

  it('should throw ServiceUnavailableException when health check fails', async () => {
    healthCheckService.check.mockRejectedValue(
      new Error('Health check failed'),
    );

    await expect(controller.readiness()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
