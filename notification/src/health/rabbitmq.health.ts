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

      return this.getStatus(key, true);
    } catch (error) {
      const result = this.getStatus(key, false);

      throw new HealthCheckError('RabbitMQ check failed', result);
    }
  }
}
