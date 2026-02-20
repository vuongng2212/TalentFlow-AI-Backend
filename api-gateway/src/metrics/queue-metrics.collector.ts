import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Gauge } from 'prom-client';
import { MetricsService } from './metrics.service';
import { QueueService } from '../queue/queue.service';

const DEFAULT_POLL_INTERVAL_MS = 30000;

@Injectable()
export class QueueMetricsCollector implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricsCollector.name);
  private readonly queueDepthGauge: Gauge<string>;
  private readonly consumerCountGauge: Gauge<string>;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {
    this.queueDepthGauge = new Gauge({
      name: 'rabbitmq_queue_messages',
      help: 'Number of messages in RabbitMQ queue',
      labelNames: ['queue'],
      registers: [this.metricsService.getRegistry()],
    });

    this.consumerCountGauge = new Gauge({
      name: 'rabbitmq_queue_consumers',
      help: 'Number of consumers for RabbitMQ queue',
      labelNames: ['queue'],
      registers: [this.metricsService.getRegistry()],
    });
  }

  async onModuleInit(): Promise<void> {
    const pollIntervalMs = this.configService.get<number>(
      'QUEUE_METRICS_POLL_INTERVAL_MS',
      DEFAULT_POLL_INTERVAL_MS,
    );

    await this.collectMetrics();

    this.intervalId = setInterval(() => {
      this.collectMetrics().catch((error) => {
        this.logger.error('Failed to collect queue metrics', error);
      });
    }, pollIntervalMs);

    this.logger.log(
      `Queue metrics collector started with ${pollIntervalMs}ms interval`,
    );
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.log('Queue metrics collector stopped');
  }

  async collectMetrics(): Promise<void> {
    const stats = await this.queueService.getQueueStats();

    for (const stat of stats) {
      this.queueDepthGauge.labels(stat.queue).set(stat.messageCount);
      this.consumerCountGauge.labels(stat.queue).set(stat.consumerCount);
    }
  }
}
