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
  private readonly paymentCounter: Counter<string>;
  private readonly paymentWorkCounter: Counter<string>;
  private readonly invoiceRenderHistogram: Histogram<string>;

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
    this.paymentCounter = new Counter({
      name: 'payment_events_total',
      help: 'Safe lifecycle events for the payment module',
      labelNames: ['operation', 'outcome'],
      registers: [this.registry],
    });
    this.paymentWorkCounter = new Counter({
      name: 'payment_work_events_total',
      help: 'Payment durable-work outcomes without payment reference labels',
      labelNames: ['kind', 'outcome'],
      registers: [this.registry],
    });
    this.invoiceRenderHistogram = new Histogram({
      name: 'payment_invoice_render_duration_seconds',
      help: 'Duration of private payment receipt rendering',
      labelNames: ['outcome'],
      buckets: [0.1, 0.25, 0.5, 1, 2, 5, 15, 30, 60],
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

  recordPaymentEvent(operation: string, outcome: string): void {
    this.paymentCounter.labels(operation, outcome).inc();
  }

  recordPaymentWork(kind: string, outcome: string): void {
    this.paymentWorkCounter.labels(kind, outcome).inc();
  }

  recordInvoiceRender(outcome: string, durationSeconds: number): void {
    this.invoiceRenderHistogram.labels(outcome).observe(durationSeconds);
  }
}
