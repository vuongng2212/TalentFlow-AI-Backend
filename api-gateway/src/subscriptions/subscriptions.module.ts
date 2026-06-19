import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MomoBillingClient } from './billing/momo-billing.client';
import { MomoSignatureService } from './billing/momo-signature.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, MomoBillingClient, MomoSignatureService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
