import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaService: PrismaService,
    private readonly rabbitmqHealthIndicator: RabbitmqHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    await this.runReadinessChecks();

    return {
      status: 'ok',
    };
  }

  @Get('ready')
  @HealthCheck()
  async readiness() {
    await this.runReadinessChecks();

    return {
      status: 'ok',
    };
  }

  @Get('live')
  liveness() {
    return {
      status: 'ok',
    };
  }

  private async runReadinessChecks(): Promise<void> {
    try {
      await this.healthCheckService.check([
        () => this.checkDatabaseHealth(),
        () => this.rabbitmqHealthIndicator.isHealthy(),
      ]);
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) {
        this.logger.error(
          'Unexpected health check failure',
          error instanceof Error ? error.stack : String(error),
        );
      }

      throw new ServiceUnavailableException({
        status: 'error',
      });
    }
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
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new HealthCheckError('Database check failed', {
        database: {
          status: 'down',
        },
      });
    }
  }
}
