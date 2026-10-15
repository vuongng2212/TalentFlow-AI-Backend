import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Invoice,
  InvoiceDocumentStatus,
  PaymentAuditAction,
  PaymentAuditActorKind,
  PaymentStatus,
  PaymentWorkKind,
  Prisma,
} from '@prisma/client';
import { PaymentAuditService } from '../payment-audit.service';
import { PaymentWorkRepository } from '../payment-work.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceRendererService } from './invoice-renderer.service';
import { InvoiceStorageService } from './invoice-storage.service';
import { MetricsService } from '../../metrics/metrics.service';

interface ChargeSnapshot {
  code: string;
  description: string;
  amountVnd: number;
  taxVnd: number;
  totalVnd: number;
  quantity: number;
  termsVersion: string;
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PaymentAuditService,
    private readonly work: PaymentWorkRepository,
    private readonly renderer: InvoiceRendererService,
    private readonly storage: InvoiceStorageService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async issueForPayment(paymentId: string): Promise<Invoice> {
    return this.prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.findUnique({
        where: { id: paymentId },
        include: { workspace: true, requester: true, invoice: true },
      });
      if (!payment) {
        throw new NotFoundException(
          'Payment was not found for invoice issuance',
        );
      }
      if (payment.invoice) {
        return payment.invoice;
      }
      if (payment.status !== PaymentStatus.SUCCEEDED) {
        throw new ConflictException(
          'A receipt can only be issued for a successful payment',
        );
      }

      const quote = payment.chargeSnapshot as unknown as ChargeSnapshot;
      const invoice = await transaction.invoice.create({
        data: {
          invoiceReference: `TFI_${payment.reference.replace(/^TFP_/, '')}`,
          paymentId: payment.id,
          issuerSnapshot: {
            name: this.prismaConfig('PAYMENT_RECEIPT_ISSUER_NAME'),
            address: this.prismaConfig('PAYMENT_RECEIPT_ISSUER_ADDRESS'),
          },
          payerSnapshot: { name: payment.workspace.name },
          lineItemsSnapshot: quote as unknown as Prisma.InputJsonValue,
          subtotalVnd: quote.amountVnd,
          taxVnd: quote.taxVnd,
          totalVnd: quote.totalVnd,
          currency: payment.currency,
        },
      });
      await this.audit.record(transaction, {
        paymentId: payment.id,
        invoiceId: invoice.id,
        action: PaymentAuditAction.INVOICE_ISSUED,
        actorKind: PaymentAuditActorKind.SCHEDULER,
      });
      await this.work.enqueue(
        transaction,
        payment.id,
        payment.reference,
        PaymentWorkKind.RENDER_INVOICE,
      );
      return invoice;
    });
  }

  async renderInvoice(invoiceId: string): Promise<void> {
    const startedAt = Date.now();
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payment: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice was not found for rendering');
    }
    if (invoice.documentStatus === InvoiceDocumentStatus.AVAILABLE) {
      return;
    }

    try {
      const quote = invoice.lineItemsSnapshot as unknown as ChargeSnapshot;
      const issuer = invoice.issuerSnapshot as unknown as {
        name: string;
        address: string;
      };
      const payer = invoice.payerSnapshot as unknown as { name: string };
      const document = await this.renderer.render({
        invoiceReference: invoice.invoiceReference,
        issuedAt: invoice.issuedAt,
        issuer,
        payer,
        item: quote,
        subtotalVnd: invoice.subtotalVnd,
        taxVnd: invoice.taxVnd,
        totalVnd: invoice.totalVnd,
        currency: invoice.currency,
      });
      const stored = await this.storage.putReceipt(
        invoice.invoiceReference,
        document,
      );
      await this.prisma.$transaction(async (transaction) => {
        await transaction.invoice.update({
          where: { id: invoice.id },
          data: {
            documentStatus: InvoiceDocumentStatus.AVAILABLE,
            storageBucket: stored.bucket,
            storageKey: stored.key,
            contentSha256: stored.contentSha256,
          },
        });
        await this.audit.record(transaction, {
          paymentId: invoice.paymentId,
          invoiceId: invoice.id,
          action: PaymentAuditAction.INVOICE_RENDERED,
          actorKind: PaymentAuditActorKind.SCHEDULER,
        });
      });
      this.metrics.recordInvoiceRender(
        'available',
        (Date.now() - startedAt) / 1000,
      );
    } catch (error) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { documentStatus: InvoiceDocumentStatus.RETRYABLE },
      });
      await this.audit.record(this.prisma, {
        paymentId: invoice.paymentId,
        invoiceId: invoice.id,
        action: PaymentAuditAction.INVOICE_RENDER_FAILED,
        actorKind: PaymentAuditActorKind.SCHEDULER,
        reasonCode: 'INVOICE_RENDER_RETRYABLE',
      });
      this.metrics.recordInvoiceRender(
        'retryable',
        (Date.now() - startedAt) / 1000,
      );
      throw error;
    }
  }

  private prismaConfig(key: string): string {
    // InvoiceService intentionally receives already-validated values through
    // the process configuration rather than allowing caller supplied issuer data.
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`${key} is required for receipt issuance`);
    }
    return value;
  }
}
