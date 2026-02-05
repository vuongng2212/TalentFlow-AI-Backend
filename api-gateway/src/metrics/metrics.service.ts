import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpHistogram: Histogram<string>;
  private readonly httpCounter: Counter<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.httpHistogram = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8],
      registers: [this.registry],
    });

    this.httpCounter = new Counter({
      name: 'http_requests_total',
      help: 'Count of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });
  }

  getRegistry(): Registry {
    return this.registry;
  }

  recordRequest(
    method: string,
    path: string,
    status: number,
    durationSeconds: number,
  ) {
    this.httpHistogram
      .labels(method, path, String(status))
      .observe(durationSeconds);
    this.httpCounter.labels(method, path, String(status)).inc();
  }
}
