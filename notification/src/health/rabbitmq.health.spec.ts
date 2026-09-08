import { HealthCheckError } from '@nestjs/terminus';
import { RabbitmqHealthIndicator } from './rabbitmq.health';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

describe('RabbitmqHealthIndicator', () => {
  let indicator: RabbitmqHealthIndicator;
  let rabbitmqService: jest.Mocked<RabbitmqService>;

  beforeEach(() => {
    rabbitmqService = {
      ping: jest.fn(),
    } as unknown as jest.Mocked<RabbitmqService>;

    indicator = new RabbitmqHealthIndicator(rabbitmqService);
  });

  it('should return up status when ping succeeds', async () => {
    rabbitmqService.ping.mockResolvedValue(undefined);

    const result = await indicator.isHealthy();
    expect(result).toEqual({ rabbitmq: { status: 'up' } });
  });

  it('should throw HealthCheckError when ping fails', async () => {
    rabbitmqService.ping.mockRejectedValue(new Error('Connection lost'));

    await expect(indicator.isHealthy()).rejects.toThrow(HealthCheckError);
  });
});
