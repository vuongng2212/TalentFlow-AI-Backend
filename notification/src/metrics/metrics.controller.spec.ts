/* eslint-disable @typescript-eslint/unbound-method */
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import type { Response } from 'express';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(() => {
    metricsService = {
      getRegistry: jest.fn().mockReturnValue({
        metrics: jest.fn().mockResolvedValue('http_requests_total 10'),
        contentType: 'text/plain; version=0.0.4',
      }),
    } as unknown as jest.Mocked<MetricsService>;

    controller = new MetricsController(metricsService);
  });

  it('should return metrics with correct content-type header', async () => {
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;

    await controller.getMetrics(res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4',
    );
    expect(res.send).toHaveBeenCalledWith('http_requests_total 10');
  });
});
