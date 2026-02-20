import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { QueueMetricsCollector } from './queue-metrics.collector';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [MetricsController],
  providers: [MetricsService, QueueMetricsCollector],
  exports: [MetricsService],
})
export class MetricsModule {}
