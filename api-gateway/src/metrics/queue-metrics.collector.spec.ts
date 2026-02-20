import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueueMetricsCollector } from './queue-metrics.collector';
import { MetricsService } from './metrics.service';
import { QueueService } from '../queue/queue.service';
import { Registry } from 'prom-client';

describe('QueueMetricsCollector', () => {
  let collector: QueueMetricsCollector;
  let queueService: jest.Mocked<QueueService>;
  let configService: jest.Mocked<ConfigService>;

  const mockRegistry = new Registry();

  beforeEach(async () => {
    mockRegistry.clear();

    const mockQueueService = {
      getQueueStats: jest.fn(),
    };

    const mockMetricsService = {
      getRegistry: jest.fn().mockReturnValue(mockRegistry),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(1000),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueMetricsCollector,
        { provide: QueueService, useValue: mockQueueService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    collector = module.get<QueueMetricsCollector>(QueueMetricsCollector);
    queueService = module.get(QueueService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    collector.onModuleDestroy();
    mockRegistry.clear();
  });

  it('should be defined', () => {
    expect(collector).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should start collecting metrics on init', async () => {
      queueService.getQueueStats.mockResolvedValue([
        { queue: 'cv.processing', messageCount: 5, consumerCount: 2 },
        { queue: 'cv.parsing.dlq', messageCount: 1, consumerCount: 0 },
      ]);

      await collector.onModuleInit();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(queueService.getQueueStats).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith(
        'QUEUE_METRICS_POLL_INTERVAL_MS',
        30000,
      );
    });

    it('should use custom poll interval from config', async () => {
      configService.get.mockReturnValue(5000);
      queueService.getQueueStats.mockResolvedValue([]);

      await collector.onModuleInit();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(configService.get).toHaveBeenCalledWith(
        'QUEUE_METRICS_POLL_INTERVAL_MS',
        30000,
      );
    });
  });

  describe('collectMetrics', () => {
    it('should update gauges with queue stats', async () => {
      const stats = [
        { queue: 'cv.processing', messageCount: 10, consumerCount: 3 },
        { queue: 'cv.parsing.dlq', messageCount: 2, consumerCount: 0 },
      ];
      queueService.getQueueStats.mockResolvedValue(stats);

      await collector.collectMetrics();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(queueService.getQueueStats).toHaveBeenCalled();

      const metrics = await mockRegistry.getMetricsAsJSON();
      const queueMessagesMetric = metrics.find(
        (m) => m.name === 'rabbitmq_queue_messages',
      );
      const queueConsumersMetric = metrics.find(
        (m) => m.name === 'rabbitmq_queue_consumers',
      );

      expect(queueMessagesMetric).toBeDefined();
      expect(queueConsumersMetric).toBeDefined();
    });

    it('should handle empty stats gracefully', async () => {
      queueService.getQueueStats.mockResolvedValue([]);

      await expect(collector.collectMetrics()).resolves.not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop collecting metrics on destroy', async () => {
      queueService.getQueueStats.mockResolvedValue([]);

      await collector.onModuleInit();
      collector.onModuleDestroy();

      const callCountBeforeDestroy =
        queueService.getQueueStats.mock.calls.length;

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(queueService.getQueueStats.mock.calls.length).toBe(
        callCountBeforeDestroy,
      );
    });
  });
});
