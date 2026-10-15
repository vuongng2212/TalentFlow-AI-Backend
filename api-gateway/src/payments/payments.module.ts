import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { PaymentsController } from './payments.controller';
import { MomoIpnController } from './momo-ipn.controller';
import { PaymentsService } from './payments.service';
import { PaymentCatalogService } from './payment-catalog.service';
import { PaymentAuditService } from './payment-audit.service';
import { PaymentWorkRepository } from './payment-work.repository';
import { PaymentRecoveryService } from './payment-recovery.service';
import { MomoClient } from './momo/momo.client';
import { MomoSignatureService } from './momo/momo-signature.service';
import { InvoiceService } from './invoice/invoice.service';
import { InvoiceRendererService } from './invoice/invoice-renderer.service';
import { InvoiceStorageService } from './invoice/invoice-storage.service';

@Module({
  imports: [MetricsModule],
  controllers: [PaymentsController, MomoIpnController],
  providers: [
    PaymentsService,
    PaymentCatalogService,
    PaymentAuditService,
    PaymentWorkRepository,
    MomoClient,
    MomoSignatureService,
    InvoiceService,
    InvoiceRendererService,
    InvoiceStorageService,
    PaymentRecoveryService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
