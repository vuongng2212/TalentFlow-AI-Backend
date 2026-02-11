import { Controller, Get, Injectable } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError('Prisma check failed', error);
    }
  }
}

@Injectable()
class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error('Redis did not return PONG');
      }
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError('Redis check failed', error);
    }
  }
}

@Controller()
export class HealthController {
  private prismaHealth: PrismaHealthIndicator;
  private redisHealth: RedisHealthIndicator;

  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    this.prismaHealth = new PrismaHealthIndicator(this.prisma);
    this.redisHealth = new RedisHealthIndicator(this.redis);
  }

  /**
   * Liveness probe - Checks if the application is alive
   * Used by Kubernetes to determine if pod should be restarted
   */
  @Public()
  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([
      // Check heap memory usage (150MB threshold)
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      // Check RSS memory usage (300MB threshold)
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
    ]);
  }

  /**
   * Readiness probe - Checks if the application is ready to serve traffic
   * Used by Kubernetes to determine if pod should receive traffic
   *
   * TODO: Add dependency checks when available:
   * - Database (Prisma) health check
   * - Redis health check
   * - BullMQ queue health check
   */
  @Public()
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      // Basic memory checks
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),

      // Database health check
      () => this.prismaHealth.isHealthy('database'),

      // Redis health check
      () => this.redisHealth.isHealthy('redis'),

      // TODO (Slice 3): Add BullMQ queue health check
      // () => this.bullmqHealth.isHealthy('queue'),
    ]);
  }
}
