import { Global, Module } from '@nestjs/common';
import { ElkLoggerService } from './elk-logger.service';

@Global()
@Module({
  providers: [ElkLoggerService],
  exports: [ElkLoggerService],
})
export class LoggerModule {}
