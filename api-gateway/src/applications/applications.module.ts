import { Module, forwardRef } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { CvOrchestrationService } from './cv-orchestration.service';
import { CvUploadService } from './cv-upload.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    CommonModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, CvOrchestrationService, CvUploadService],
  exports: [ApplicationsService, CvOrchestrationService, CvUploadService],
})
export class ApplicationsModule {}
