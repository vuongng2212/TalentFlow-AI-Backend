import { Global, Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';
import { ApplicationsModule } from '../applications/applications.module';

@Global()
@Module({
  imports: [ConfigModule, forwardRef(() => ApplicationsModule)],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
