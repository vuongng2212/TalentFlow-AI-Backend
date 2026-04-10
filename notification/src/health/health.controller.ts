import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicator,
  HealthIndicatorResult,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

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
class RabbitMQHealthIndicator extends HealthIndicator {
  constructor(private readonly rabbitmq: RabbitmqService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.rabbitmq.isHealthy();
      if (!isHealthy) {
        throw new Error('RabbitMQ connection is not healthy');
      }
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError('RabbitMQ check failed', error);
    }
  }
}

@ApiTags('health')
@Controller()
export class HealthController {
  private readonly prismaHealth: PrismaHealthIndicator;
  private readonly rabbitmqHealth: RabbitMQHealthIndicator;

  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitmqService,
  ) {
    this.prismaHealth = new PrismaHealthIndicator(this.prisma);
    this.rabbitmqHealth = new RabbitMQHealthIndicator(this.rabbitmq);
  }

  @Public()
  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 1000 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 1000 * 1024 * 1024),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 1000 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 1000 * 1024 * 1024),
      () => this.prismaHealth.isHealthy('database'),
      () => this.rabbitmqHealth.isHealthy('queue'),
    ]);
  }
}
