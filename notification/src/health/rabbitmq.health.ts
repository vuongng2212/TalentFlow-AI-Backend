import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class RabbitmqHealthIndicator extends HealthIndicator {
  constructor(private readonly rabbitmqService: RabbitmqService) {
    super();
  }

  async isHealthy(key = 'rabbitmq'): Promise<HealthIndicatorResult> {
    try {
      await this.rabbitmqService.ping();

      return this.getStatus(key, true, {
        exchange: this.rabbitmqService.getExchangeName(),
        queue: this.rabbitmqService.getQueueName(),
      });
    } catch (error) {
      const result = this.getStatus(key, false, {
        exchange: this.rabbitmqService.getExchangeName(),
        queue: this.rabbitmqService.getQueueName(),
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new HealthCheckError('RabbitMQ check failed', result);
    }
  }
}
