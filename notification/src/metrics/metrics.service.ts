import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Exposes Prometheus metrics for the Notification service.
 *
 * Metrics:
 *  - notification_sent_total         — counter per channel/status
 *  - notification_delivery_duration_seconds — histogram per channel
 *  - notification_websocket_connections     — gauge of active WS connections
 */
@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly notificationCounter: Counter<string>;
  private readonly deliveryHistogram: Histogram<string>;
  private readonly wsConnectionsGauge: Gauge<string>;
  private readonly emailAttemptsCounter: Counter<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.notificationCounter = new Counter({
      name: 'notification_sent_total',
      help: 'Total notifications sent, partitioned by channel and status',
      labelNames: ['channel', 'status'],
      registers: [this.registry],
    });

    this.deliveryHistogram = new Histogram({
      name: 'notification_delivery_duration_seconds',
      help: 'Duration of notification delivery operations in seconds',
      labelNames: ['channel'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [this.registry],
    });

    this.wsConnectionsGauge = new Gauge({
      name: 'notification_websocket_connections',
      help: 'Current number of active WebSocket connections',
      registers: [this.registry],
    });

    this.emailAttemptsCounter = new Counter({
      name: 'email_attempts_total',
      help: 'Total email send attempts, including retries',
      registers: [this.registry],
    });
  }

  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Increment notification sent counter.
   * @param channel  'email' | 'websocket'
   * @param status   'success' | 'failure'
   */
  recordNotificationSent(channel: string, status: 'success' | 'failure'): void {
    this.notificationCounter.labels(channel, status).inc();
  }

  /**
   * Observe delivery duration.
   * @param channel       'email' | 'websocket'
   * @param durationMs    elapsed milliseconds
   */
  recordDeliveryDuration(channel: string, durationMs: number): void {
    this.deliveryHistogram.labels(channel).observe(durationMs / 1000);
  }

  /** Call when a WebSocket client connects. */
  wsClientConnected(): void {
    this.wsConnectionsGauge.inc();
  }

  /** Call when a WebSocket client disconnects. */
  wsClientDisconnected(): void {
    this.wsConnectionsGauge.dec();
  }

  /** Call on each email send attempt. */
  recordEmailAttempt(): void {
    this.emailAttemptsCounter.inc();
  }
}
