import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '../prisma/prisma.module';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';
import { HealthController } from './health.controller';
import { RabbitmqHealthIndicator } from './rabbitmq.health';

@Module({
  imports: [TerminusModule, PrismaModule, RabbitmqModule],
  controllers: [HealthController],
  providers: [RabbitmqHealthIndicator],
})
export class HealthModule {}
