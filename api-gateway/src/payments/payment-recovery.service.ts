import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentAuditAction,
  PaymentAuditActorKind,
  PaymentCheckoutStatus,
  PaymentStatus,
  PaymentWorkKind,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from './invoice/invoice.service';
import { MomoClient } from './momo/momo.client';
import { MomoProviderError } from './momo/momo.types';
import { PaymentAuditService } from './payment-audit.service';
import { PaymentWorkRepository } from './payment-work.repository';
import { PaymentsService } from './payments.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class PaymentRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentRecoveryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly momo: MomoClient,
    private readonly work: PaymentWorkRepository,
    private readonly audit: PaymentAuditService,
    private readonly invoices: InvoiceService,
    private readonly metrics: MetricsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit(): void {
    const intervalMs =
      this.config.get<number>('PAYMENT_RECOVERY_INTERVAL_SECONDS', 30) * 1000;
    this.timer = setInterval(() => void this.runDueWork(), intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runDueWork(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    const leaseOwner = `payment-worker-${randomUUID()}`;
    try {
      const records = await this.work.claimDue(
        leaseOwner,
        this.config.get<number>('PAYMENT_RECOVERY_LEASE_SECONDS', 60),
      );
      await Promise.all(
        records.map((record) => this.process(record, leaseOwner)),
      );
    } finally {
      this.running = false;
    }
  }

  async createCheckoutForPayment(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.checkoutStatus === PaymentCheckoutStatus.READY) {
      return;
    }

    const claimed = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        checkoutStatus: {
          in: [
            PaymentCheckoutStatus.NOT_REQUESTED,
            PaymentCheckoutStatus.UNKNOWN,
          ],
        },
      },
      data: { checkoutStatus: PaymentCheckoutStatus.REQUESTING },
    });
    if (claimed.count !== 1) {
      return;
    }
    try {
      const result = await this.momo.createCheckout({
        orderId: payment.momoOrderId,
        requestId: payment.momoRequestId,
        amount: payment.amountVnd,
        orderInfo: `TalentFlow payment ${payment.reference}`,
      });
      await this.prisma.$transaction(async (transaction) => {
        const isReady = result.resultCode === 0 && Boolean(result.payUrl);
        await transaction.payment.update({
          where: { id: payment.id },
          data: isReady
            ? {
                checkoutStatus: PaymentCheckoutStatus.READY,
                checkoutUrl: result.payUrl,
              }
            : {
                checkoutStatus: PaymentCheckoutStatus.UNAVAILABLE,
                providerResultCode: result.resultCode,
              },
        });
        await this.audit.record(transaction, {
          paymentId: payment.id,
          action: isReady
            ? PaymentAuditAction.CHECKOUT_READY
            : PaymentAuditAction.CHECKOUT_UNKNOWN,
          actorKind: PaymentAuditActorKind.SCHEDULER,
          reasonCode: isReady ? undefined : 'MOMO_CHECKOUT_REJECTED',
        });
      });
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { checkoutStatus: PaymentCheckoutStatus.UNKNOWN },
      });
      await this.audit.record(this.prisma, {
        paymentId: payment.id,
        action: PaymentAuditAction.CHECKOUT_UNKNOWN,
        actorKind: PaymentAuditActorKind.SCHEDULER,
        reasonCode: this.safeErrorCode(error),
      });
      throw error;
    }
  }

  private async process(
    record: {
      id: string;
      paymentId: string;
      kind: PaymentWorkKind;
      attemptCount: number;
    },
    leaseOwner: string,
  ): Promise<void> {
    try {
      switch (record.kind) {
        case PaymentWorkKind.CREATE_CHECKOUT:
          await this.createCheckoutForPayment(record.paymentId);
          break;
        case PaymentWorkKind.RECONCILE_MOMO:
          await this.reconcilePayment(record.paymentId);
          break;
        case PaymentWorkKind.APPLY_SUCCESS:
          await this.recordOutcome(record.paymentId, true);
          break;
        case PaymentWorkKind.APPLY_FAILURE:
          await this.recordOutcome(record.paymentId, false);
          break;
        case PaymentWorkKind.ISSUE_INVOICE:
          await this.invoices.issueForPayment(record.paymentId);
          break;
        case PaymentWorkKind.RENDER_INVOICE: {
          const invoice = await this.prisma.invoice.findUnique({
            where: { paymentId: record.paymentId },
            select: { id: true },
          });
          if (!invoice) {
            throw new Error('INVOICE_MISSING');
          }
          await this.invoices.renderInvoice(invoice.id);
          break;
        }
      }
      await this.work.complete(record.id, leaseOwner);
      this.metrics.recordPaymentWork(record.kind, 'completed');
      this.logger.log({
        event: 'payment_work_completed',
        paymentId: record.paymentId,
        workKind: record.kind,
      });
    } catch (error) {
      const safeFailureCode = this.safeErrorCode(error);
      await this.work.retry(
        record,
        leaseOwner,
        safeFailureCode,
        this.config.get<number>('PAYMENT_RECOVERY_MAX_ATTEMPTS', 10),
      );
      await this.audit.record(this.prisma, {
        paymentId: record.paymentId,
        action: PaymentAuditAction.WORK_RETRIED,
        actorKind: PaymentAuditActorKind.SCHEDULER,
        reasonCode: safeFailureCode,
      });
      this.metrics.recordPaymentWork(record.kind, 'retryable');
      this.logger.warn({
        event: 'payment_work_retryable',
        paymentId: record.paymentId,
        workKind: record.kind,
        reasonCode: safeFailureCode,
      });
    }
  }

  private async reconcilePayment(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.status !== PaymentStatus.PENDING) {
      return;
    }
    const result = await this.momo.queryPayment({
      orderId: payment.momoOrderId,
      requestId: payment.momoRequestId,
    });
    await this.payments.handleVerifiedQueryResult(result);
    await this.audit.record(this.prisma, {
      paymentId: payment.id,
      action: PaymentAuditAction.RECONCILIATION_COMPLETED,
      actorKind: PaymentAuditActorKind.SCHEDULER,
      reasonCode: `MOMO_RESULT_${result.resultCode}`,
    });
  }

  private async recordOutcome(
    paymentId: string,
    isSuccess: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.findUnique({
        where: { id: paymentId },
      });
      if (!payment) {
        return;
      }
      const unsuccessfulTerminalStates: PaymentStatus[] = [
        PaymentStatus.FAILED,
        PaymentStatus.EXPIRED,
        PaymentStatus.CANCELLED,
        PaymentStatus.REJECTED,
      ];
      const recorded = await transaction.payment.updateMany({
        where: {
          id: paymentId,
          outcomeRecordedAt: null,
          status: isSuccess
            ? PaymentStatus.SUCCEEDED
            : { in: unsuccessfulTerminalStates },
        },
        data: { outcomeRecordedAt: new Date() },
      });
      if (recorded.count === 0) {
        return;
      }
      await this.audit.record(transaction, {
        paymentId,
        action: PaymentAuditAction.OUTCOME_RECORDED,
        actorKind: PaymentAuditActorKind.SCHEDULER,
      });
      if (isSuccess) {
        await this.work.enqueue(
          transaction,
          payment.id,
          payment.reference,
          PaymentWorkKind.ISSUE_INVOICE,
        );
      }
    });
  }

  private safeErrorCode(error: unknown): string {
    if (error instanceof MomoProviderError) {
      return error.safeCode;
    }
    if (error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)) {
      return error.message;
    }
    return 'PAYMENT_WORK_RETRYABLE';
  }
}
