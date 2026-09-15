import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Exposes the Prometheus scrape endpoint.
 * No auth required — Prometheus scrapes this internally.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getRegistry().metrics();
    res.setHeader(
      'Content-Type',
      this.metricsService.getRegistry().contentType,
    );
    res.send(metrics);
  }
}
