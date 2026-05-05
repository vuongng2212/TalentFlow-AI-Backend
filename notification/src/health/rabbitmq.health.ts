import { Injectable, Logger } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class RabbitmqHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RabbitmqHealthIndicator.name);

  constructor(private readonly rabbitmqService: RabbitmqService) {
    super();
  }

  async isHealthy(key = 'rabbitmq'): Promise<HealthIndicatorResult> {
    try {
      await this.rabbitmqService.ping();

      return this.getStatus(key, true);
    } catch (error) {
      this.logger.error(
        'RabbitMQ health check failed',
        error instanceof Error ? error.stack : String(error),
      );

      const result = this.getStatus(key, false);

      throw new HealthCheckError('RabbitMQ check failed', result);
    }
  }
}
