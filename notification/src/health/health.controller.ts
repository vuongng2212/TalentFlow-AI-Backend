import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitmqHealthIndicator } from './rabbitmq.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaService: PrismaService,
    private readonly rabbitmqHealthIndicator: RabbitmqHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    return this.healthCheckService.check([
      () => this.checkDatabaseHealth(),
      () => this.rabbitmqHealthIndicator.isHealthy(),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  async readiness() {
    return this.healthCheckService.check([
      () => this.checkDatabaseHealth(),
      () => this.rabbitmqHealthIndicator.isHealthy(),
    ]);
  }

  @Get('live')
  liveness() {
    return {
      status: 'ok',
    };
  }

  private async checkDatabaseHealth(): Promise<HealthIndicatorResult> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;

      return {
        database: {
          status: 'up',
        },
      };
    } catch (error) {
      throw new HealthCheckError('Database check failed', {
        database: {
          status: 'down',
        },
      });
    }
  }
}
