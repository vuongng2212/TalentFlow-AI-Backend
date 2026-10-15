import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { forwardRef } from '@nestjs/common';
import {
  Payment,
  PaymentAuditAction,
  PaymentAuditActorKind,
  PaymentIdempotencyOperation,
  PaymentResultDisposition,
  PaymentStatus,
  PaymentWorkKind,
  Prisma,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { PaymentCatalogService } from './payment-catalog.service';
import { PaymentAuditService } from './payment-audit.service';
import { PaymentWorkRepository } from './payment-work.repository';
import { MomoSignatureService } from './momo/momo-signature.service';
import {
  MOMO_PROCESSING_RESULT_CODES,
  MomoIpnPayload,
  PaymentQuote,
} from './momo/momo.types';
import { PaymentRecoveryService } from './payment-recovery.service';
import { InvoiceStorageService } from './invoice/invoice-storage.service';

const MAX_SERIALIZATION_RETRIES = 3;
const PAYMENT_WORKSPACE_ROLES = [
  WorkspaceMemberRole.OWNER,
  WorkspaceMemberRole.ADMIN,
];

const safePaymentInclude = {
  invoice: true,
} as const;

type PaymentWithInvoice = Prisma.PaymentGetPayload<{
  include: typeof safePaymentInclude;
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: PaymentCatalogService,
    private readonly audit: PaymentAuditService,
    private readonly work: PaymentWorkRepository,
    private readonly signatures: MomoSignatureService,
    private readonly metrics: MetricsService,
    private readonly invoiceStorage: InvoiceStorageService,
    @Inject(forwardRef(() => PaymentRecoveryService))
    private readonly recovery: PaymentRecoveryService,
  ) {}

  async createPayment(
    workspaceId: string,
    requesterId: string,
    payableItemCode: string,
    rawIdempotencyKey: string,
  ) {
    const idempotencyKey = this.normalizeIdempotencyKey(rawIdempotencyKey);
    const quote = this.catalogue.resolve(payableItemCode);
    const keyDigest = this.digest(idempotencyKey);
    const requestFingerprint = this.fingerprint(workspaceId, quote);

    let accepted: { payment: Payment; replayed: boolean } | undefined;
    for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
        accepted = await this.prisma.$transaction(
          async (transaction) => {
            const membership = await transaction.workspaceMember.findFirst({
              where: {
                workspaceId,
                userId: requesterId,
                status: WorkspaceMemberStatus.ACTIVE,
                role: { in: PAYMENT_WORKSPACE_ROLES },
              },
              select: { id: true },
            });
            if (!membership) {
              throw new ForbiddenException(
                'Only active workspace owners or administrators can initiate a payment',
              );
            }

            const existing = await transaction.payment.findUnique({
              where: {
                requesterId_workspaceId_idempotencyOperation_idempotencyKeyDigest:
                  {
                    requesterId,
                    workspaceId,
                    idempotencyOperation:
                      PaymentIdempotencyOperation.INITIATE_MOMO_CHECKOUT,
                    idempotencyKeyDigest: keyDigest,
                  },
              },
            });
            if (existing) {
              if (
                existing.idempotencyRequestFingerprint !== requestFingerprint
              ) {
                throw new ConflictException(
                  'This idempotency key is already bound to a different payment intent',
                );
              }
              return { payment: existing, replayed: true };
            }

            const reference = `TFP_${randomUUID().replaceAll('-', '')}`;
            const payment = await transaction.payment.create({
              data: {
                reference,
                workspaceId,
                requesterId,
                idempotencyOperation:
                  PaymentIdempotencyOperation.INITIATE_MOMO_CHECKOUT,
                idempotencyKeyDigest: keyDigest,
                idempotencyRequestFingerprint: requestFingerprint,
                momoOrderId: reference,
                momoRequestId: randomUUID(),
                amountVnd: quote.totalVnd,
                currency: 'VND',
                chargeSnapshot: quote as unknown as Prisma.InputJsonValue,
              },
            });
            await this.audit.record(transaction, {
              paymentId: payment.id,
              action: PaymentAuditAction.PAYMENT_CREATED,
              actorKind: PaymentAuditActorKind.USER,
            });
            await this.work.enqueue(
              transaction,
              payment.id,
              payment.reference,
              PaymentWorkKind.CREATE_CHECKOUT,
            );
            return { payment, replayed: false };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        if (
          this.isPrismaCode(error, 'P2034') &&
          attempt < MAX_SERIALIZATION_RETRIES - 1
        ) {
          await this.wait(20 * 2 ** attempt + Math.floor(Math.random() * 20));
          continue;
        }
        if (this.isPrismaCode(error, 'P2002')) {
          accepted = await this.readConcurrentIdempotency(
            requesterId,
            workspaceId,
            keyDigest,
            requestFingerprint,
          );
          break;
        }
        throw error;
      }
    }

    if (!accepted) {
      throw new ConflictException(
        'The payment request could not be accepted safely',
      );
    }
    if (accepted.replayed) {
      await this.audit.record(this.prisma, {
        paymentId: accepted.payment.id,
        action: PaymentAuditAction.IDEMPOTENCY_REPLAYED,
        actorKind: PaymentAuditActorKind.USER,
      });
    }
    this.metrics.recordPaymentEvent(
      'initiation',
      accepted.replayed ? 'replayed' : 'accepted',
    );
    try {
      await this.recovery.createCheckoutForPayment(accepted.payment.id);
    } catch {
      // The durable CREATE_CHECKOUT record is intentionally left for the
      // worker; a provider timeout must return the same pending payment.
    }
    return this.getCheckoutProjection(accepted.payment.id, requesterId);
  }

  async getCheckoutProjection(paymentId: string, requesterId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: safePaymentInclude,
    });
    if (!payment) {
      throw new NotFoundException('Payment was not found');
    }
    return this.projectPayment(payment, payment.requesterId === requesterId);
  }

  async getPayment(workspaceId: string, paymentReference: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { workspaceId, reference: paymentReference },
      include: {
        invoice: true,
        auditEvents: { orderBy: { occurredAt: 'asc' } },
        providerResults: {
          orderBy: { receivedAt: 'asc' },
          select: {
            partnerCode: true,
            orderId: true,
            requestId: true,
            momoTransactionId: true,
            resultCode: true,
            disposition: true,
            reasonCode: true,
            receivedAt: true,
            duplicateCount: true,
          },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException(
        'Payment was not found in the resolved workspace',
      );
    }
    return {
      ...this.projectPayment(payment, false),
      auditEvents: payment.auditEvents.map((event) => ({
        action: event.action,
        actorKind: event.actorKind,
        previousState: event.previousState,
        newState: event.newState,
        reasonCode: event.reasonCode,
        occurredAt: event.occurredAt,
      })),
      providerResults: payment.providerResults.map((result) => ({
        partnerCode: result.partnerCode,
        orderId: result.orderId,
        requestId: result.requestId,
        providerTransactionReference:
          result.momoTransactionId?.toString() ?? null,
        resultCode: result.resultCode,
        disposition: result.disposition,
        reasonCode: result.reasonCode,
        receivedAt: result.receivedAt,
        duplicateCount: result.duplicateCount,
      })),
    };
  }

  async listPayments(
    workspaceId: string,
    options: { status?: PaymentStatus; cursor?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const payments = await this.prisma.payment.findMany({
      where: { workspaceId, status: options.status },
      include: safePaymentInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    const items = payments.slice(0, limit);
    return {
      items: items.map((payment) => this.projectPayment(payment, false)),
      nextCursor: payments.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async getInvoice(workspaceId: string, paymentReference: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { workspaceId, reference: paymentReference },
      include: { invoice: true },
    });
    if (!payment) {
      throw new NotFoundException(
        'Payment was not found in the resolved workspace',
      );
    }
    if (payment.status !== PaymentStatus.SUCCEEDED || !payment.invoice) {
      throw new ConflictException(
        'A receipt is not available for this payment',
      );
    }
    return this.projectInvoice(payment.invoice, payment.reference);
  }

  async getInvoiceDownload(workspaceId: string, paymentReference: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { workspaceId, reference: paymentReference },
      include: { invoice: true },
    });
    if (!payment) {
      throw new NotFoundException(
        'Payment was not found in the resolved workspace',
      );
    }
    if (payment.status !== PaymentStatus.SUCCEEDED || !payment.invoice) {
      throw new ConflictException(
        'A receipt is not available for this payment',
      );
    }
    if (
      payment.invoice.documentStatus !== 'AVAILABLE' ||
      !payment.invoice.storageKey
    ) {
      return this.projectInvoice(payment.invoice, payment.reference);
    }
    const download = await this.invoiceStorage.createDownloadUrl(
      payment.invoice.storageKey,
    );
    return {
      invoiceReference: payment.invoice.invoiceReference,
      downloadUrl: download.url,
      expiresAt: download.expiresAt,
    };
  }

  async scheduleReconciliation(
    workspaceId: string,
    requesterId: string,
    paymentReference: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { workspaceId, reference: paymentReference },
    });
    if (!payment) {
      throw new NotFoundException(
        'Payment was not found in the resolved workspace',
      );
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        'A final payment does not need reconciliation',
      );
    }
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: requesterId,
        status: WorkspaceMemberStatus.ACTIVE,
        role: { in: PAYMENT_WORKSPACE_ROLES },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        'Only an owner or administrator can reconcile a payment',
      );
    }
    await this.work.reschedule(
      payment.id,
      payment.reference,
      PaymentWorkKind.RECONCILE_MOMO,
    );
    await this.audit.record(this.prisma, {
      paymentId: payment.id,
      action: PaymentAuditAction.RECONCILIATION_COMPLETED,
      actorKind: PaymentAuditActorKind.USER,
      reasonCode: 'RECONCILIATION_SCHEDULED',
    });
    return this.getCheckoutProjection(payment.id, requesterId);
  }

  async handleIpn(payload: MomoIpnPayload): Promise<void> {
    this.metrics.recordPaymentEvent('ipn', 'received');
    await this.recordProviderResult(
      payload,
      this.signatures.verifyIpn(payload),
      PaymentAuditActorKind.MOMO,
    );
  }

  async handleVerifiedQueryResult(payload: MomoIpnPayload): Promise<void> {
    await this.recordProviderResult(
      payload,
      this.signatures.verifyQueryResponse(payload),
      PaymentAuditActorKind.SCHEDULER,
    );
  }

  private async recordProviderResult(
    payload: MomoIpnPayload,
    signatureValid: boolean,
    actorKind: PaymentAuditActorKind,
  ): Promise<void> {
    const semanticKey = this.digest(
      [
        payload.partnerCode,
        payload.orderId,
        payload.requestId,
        String(payload.amount),
        String(payload.transId),
        String(payload.resultCode),
        String(payload.responseTime),
        signatureValid ? 'VERIFIED' : this.digest(payload.signature),
      ].join('|'),
    );
    const safePayload = {
      partnerCode: payload.partnerCode,
      orderId: payload.orderId,
      requestId: payload.requestId,
      amount: payload.amount,
      orderInfo: payload.orderInfo,
      orderType: payload.orderType,
      transId: String(payload.transId),
      resultCode: payload.resultCode,
      payType: payload.payType,
      responseTime: String(payload.responseTime),
    };

    try {
      await this.prisma.$transaction(async (transaction) => {
        const duplicate = await transaction.paymentProviderResult.findUnique({
          where: { semanticKey },
        });
        if (duplicate) {
          await transaction.paymentProviderResult.update({
            where: { id: duplicate.id },
            data: {
              duplicateCount: { increment: 1 },
              lastReceivedAt: new Date(),
            },
          });
          if (duplicate.paymentId) {
            await this.audit.record(transaction, {
              paymentId: duplicate.paymentId,
              action: PaymentAuditAction.PROVIDER_RESULT_DUPLICATE,
              actorKind,
            });
          }
          return;
        }

        const payment = await transaction.payment.findUnique({
          where: { momoOrderId: payload.orderId },
        });
        const base = {
          semanticKey,
          partnerCode: payload.partnerCode,
          orderId: payload.orderId,
          requestId: payload.requestId,
          momoTransactionId: this.toBigInt(payload.transId),
          resultCode: payload.resultCode,
          claimedOutcome: this.claimedOutcome(payload.resultCode),
          responseTime: this.toDate(payload.responseTime),
          safePayload: safePayload as Prisma.InputJsonValue,
        };

        if (!signatureValid || !payment) {
          const reasonCode = !signatureValid
            ? 'INVALID_SIGNATURE'
            : 'UNKNOWN_PAYMENT';
          await transaction.paymentProviderResult.create({
            data: {
              ...base,
              disposition: PaymentResultDisposition.REJECTED,
              reasonCode,
              paymentId: payment?.id,
            },
          });
          if (payment) {
            await this.audit.record(transaction, {
              paymentId: payment.id,
              action: PaymentAuditAction.PROVIDER_RESULT_REJECTED,
              actorKind,
              reasonCode,
            });
          }
          this.metrics.recordPaymentEvent('ipn_verification', 'rejected');
          return;
        }

        const matches =
          payload.partnerCode === this.signatures.getPartnerCode() &&
          payload.requestId === payment.momoRequestId &&
          payload.amount === payment.amountVnd &&
          payment.currency === 'VND' &&
          payload.orderInfo === this.orderInfo(payment.reference);
        if (!matches) {
          await transaction.paymentProviderResult.create({
            data: {
              ...base,
              paymentId: payment.id,
              disposition: PaymentResultDisposition.REJECTED,
              reasonCode: 'PAYMENT_MISMATCH',
            },
          });
          await this.audit.record(transaction, {
            paymentId: payment.id,
            action: PaymentAuditAction.PROVIDER_RESULT_REJECTED,
            actorKind,
            reasonCode: 'PAYMENT_MISMATCH',
          });
          this.metrics.recordPaymentEvent('ipn_verification', 'mismatch');
          return;
        }

        if (payment.status !== PaymentStatus.PENDING) {
          await transaction.paymentProviderResult.create({
            data: {
              ...base,
              paymentId: payment.id,
              disposition: PaymentResultDisposition.CONFLICT_IGNORED,
              reasonCode: 'FINAL_STATE_CONFLICT',
            },
          });
          await this.audit.record(transaction, {
            paymentId: payment.id,
            action: PaymentAuditAction.PROVIDER_RESULT_CONFLICT,
            actorKind,
            previousState: payment.status,
            newState: payment.status,
            reasonCode: 'FINAL_STATE_CONFLICT',
          });
          this.metrics.recordPaymentEvent('ipn_verification', 'conflict');
          return;
        }

        const nextStatus = this.statusForResultCode(payload.resultCode);
        await transaction.paymentProviderResult.create({
          data: {
            ...base,
            paymentId: payment.id,
            disposition: PaymentResultDisposition.VERIFIED,
            reasonCode: `MOMO_RESULT_${payload.resultCode}`,
          },
        });

        if (nextStatus === PaymentStatus.PENDING) {
          await this.work.enqueue(
            transaction,
            payment.id,
            payment.reference,
            PaymentWorkKind.RECONCILE_MOMO,
          );
          await this.audit.record(transaction, {
            paymentId: payment.id,
            action: PaymentAuditAction.PROVIDER_RESULT_VERIFIED,
            actorKind,
            previousState: PaymentStatus.PENDING,
            newState: PaymentStatus.PENDING,
            reasonCode: `MOMO_RESULT_${payload.resultCode}`,
          });
          this.metrics.recordPaymentEvent('ipn_verification', 'processing');
          return;
        }

        const updated = await transaction.payment.updateMany({
          where: { id: payment.id, status: PaymentStatus.PENDING },
          data: {
            status: nextStatus,
            momoTransactionId: this.toBigInt(payload.transId),
            providerResultCode: payload.resultCode,
            ...(nextStatus === PaymentStatus.SUCCEEDED
              ? { succeededAt: new Date() }
              : nextStatus === PaymentStatus.CANCELLED
                ? { cancelledAt: new Date() }
                : { failedAt: new Date() }),
          },
        });
        if (updated.count === 0) {
          return;
        }
        await this.audit.record(transaction, {
          paymentId: payment.id,
          action: PaymentAuditAction.STATE_CHANGED,
          actorKind,
          previousState: PaymentStatus.PENDING,
          newState: nextStatus,
          reasonCode: `MOMO_RESULT_${payload.resultCode}`,
        });
        await this.work.enqueue(
          transaction,
          payment.id,
          payment.reference,
          nextStatus === PaymentStatus.SUCCEEDED
            ? PaymentWorkKind.APPLY_SUCCESS
            : PaymentWorkKind.APPLY_FAILURE,
        );
        this.metrics.recordPaymentEvent('ipn_verification', 'verified');
      });
    } catch (error) {
      if (this.isPrismaCode(error, 'P2002')) {
        // A competing callback committed the same semantic receipt first. It
        // is safe for MoMo to receive the same 204 acknowledgement.
        return;
      }
      throw error;
    }
  }

  private async readConcurrentIdempotency(
    requesterId: string,
    workspaceId: string,
    keyDigest: string,
    fingerprint: string,
  ): Promise<{ payment: Payment; replayed: boolean }> {
    const existing = await this.prisma.payment.findUnique({
      where: {
        requesterId_workspaceId_idempotencyOperation_idempotencyKeyDigest: {
          requesterId,
          workspaceId,
          idempotencyOperation:
            PaymentIdempotencyOperation.INITIATE_MOMO_CHECKOUT,
          idempotencyKeyDigest: keyDigest,
        },
      },
    });
    if (!existing || existing.idempotencyRequestFingerprint !== fingerprint) {
      throw new ConflictException(
        'This idempotency key is already bound to a different payment intent',
      );
    }
    return { payment: existing, replayed: true };
  }

  private projectPayment(
    payment: PaymentWithInvoice | Payment,
    includeCheckout: boolean,
  ) {
    const quote = payment.chargeSnapshot as unknown as PaymentQuote;
    const invoice = 'invoice' in payment ? payment.invoice : null;
    return {
      reference: payment.reference,
      payableItem: {
        code: quote.code,
        description: quote.description,
        quantity: quote.quantity,
        termsVersion: quote.termsVersion,
      },
      amountVnd: quote.amountVnd,
      taxVnd: quote.taxVnd,
      totalVnd: quote.totalVnd,
      currency: payment.currency,
      status: payment.status,
      checkoutStatus: payment.checkoutStatus,
      expiresAt: payment.expiresAt,
      providerTransactionReference:
        payment.momoTransactionId?.toString() ?? null,
      invoiceReference: invoice?.invoiceReference ?? null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      ...(includeCheckout
        ? {
            checkout: {
              status: payment.checkoutStatus,
              payUrl: payment.checkoutUrl,
            },
          }
        : {}),
    };
  }

  private projectInvoice(
    invoice: {
      invoiceReference: string;
      issuedAt: Date;
      lineItemsSnapshot: Prisma.JsonValue;
      subtotalVnd: number;
      taxVnd: number;
      totalVnd: number;
      currency: string;
      documentStatus: string;
    },
    paymentReference: string,
  ) {
    return {
      invoiceReference: invoice.invoiceReference,
      paymentReference,
      issuedAt: invoice.issuedAt,
      lineItems: [invoice.lineItemsSnapshot],
      subtotalVnd: invoice.subtotalVnd,
      taxVnd: invoice.taxVnd,
      totalVnd: invoice.totalVnd,
      currency: invoice.currency,
      documentStatus: invoice.documentStatus,
    };
  }

  private normalizeIdempotencyKey(raw: string): string {
    const value = raw?.trim();
    if (!value || value.length < 8 || value.length > 255) {
      throw new BadRequestException(
        'Idempotency-Key must contain 8 to 255 characters',
      );
    }
    return value;
  }

  private fingerprint(workspaceId: string, quote: PaymentQuote): string {
    return this.digest(
      [
        PaymentIdempotencyOperation.INITIATE_MOMO_CHECKOUT,
        workspaceId,
        quote.code,
        quote.amountVnd,
        quote.taxVnd,
        quote.totalVnd,
        quote.termsVersion,
        'VND',
      ].join('|'),
    );
  }

  private digest(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private orderInfo(reference: string): string {
    return `TalentFlow payment ${reference}`;
  }

  private statusForResultCode(resultCode: number): PaymentStatus {
    if (resultCode === 0) {
      return PaymentStatus.SUCCEEDED;
    }
    if (MOMO_PROCESSING_RESULT_CODES.has(resultCode)) {
      return PaymentStatus.PENDING;
    }
    if (resultCode === 49) {
      return PaymentStatus.CANCELLED;
    }
    if (resultCode === 41) {
      return PaymentStatus.EXPIRED;
    }
    if (resultCode === 40) {
      return PaymentStatus.REJECTED;
    }
    return PaymentStatus.FAILED;
  }

  private claimedOutcome(resultCode: number): string {
    return this.statusForResultCode(resultCode);
  }

  private toBigInt(value: string | number): bigint | undefined {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }

  private toDate(value: string | number): Date | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? new Date(parsed) : undefined;
  }

  private isPrismaCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === code
    );
  }

  private wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
