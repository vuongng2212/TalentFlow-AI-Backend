import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { NotificationConsumer } from './notification.consumer';
import { RabbitmqService } from './rabbitmq.service';

@Module({
  imports: [NotificationModule],
  providers: [RabbitmqService, NotificationConsumer],
  exports: [RabbitmqService],
})
export class RabbitmqModule {}
