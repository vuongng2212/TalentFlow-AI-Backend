import { Injectable } from '@nestjs/common';
import {
  PaymentProcessingRecord,
  PaymentWorkKind,
  PaymentWorkStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type WorkClient =
  | Pick<PrismaService, 'paymentProcessingRecord'>
  | Prisma.TransactionClient;

@Injectable()
export class PaymentWorkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(
    client: WorkClient,
    paymentId: string,
    paymentReference: string,
    kind: PaymentWorkKind,
  ): Promise<void> {
    const workKey = `${paymentReference}:${kind}`;
    await client.paymentProcessingRecord.upsert({
      where: { workKey },
      create: { paymentId, workKey, kind },
      update: {},
    });
  }

  async claimDue(
    leaseOwner: string,
    leaseSeconds: number,
    limit = 10,
  ): Promise<PaymentProcessingRecord[]> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000);
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM payment_processing_records
        WHERE (
          status IN ('PENDING'::"PaymentWorkStatus", 'RETRYABLE'::"PaymentWorkStatus")
          AND available_at <= ${now}
        ) OR (
          status = 'LEASED'::"PaymentWorkStatus"
          AND lease_expires_at <= ${now}
        )
        ORDER BY available_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;
      const ids = rows.map((row) => row.id);
      if (ids.length === 0) {
        return [];
      }

      await transaction.paymentProcessingRecord.updateMany({
        where: { id: { in: ids } },
        data: {
          status: PaymentWorkStatus.LEASED,
          leaseOwner,
          leaseExpiresAt,
          lastAttemptAt: now,
          attemptCount: { increment: 1 },
        },
      });

      return transaction.paymentProcessingRecord.findMany({
        where: { id: { in: ids }, leaseOwner },
      });
    });
  }

  async complete(workId: string, leaseOwner: string): Promise<boolean> {
    const result = await this.prisma.paymentProcessingRecord.updateMany({
      where: {
        id: workId,
        leaseOwner,
        status: PaymentWorkStatus.LEASED,
      },
      data: {
        status: PaymentWorkStatus.COMPLETED,
        completedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        safeFailureCode: null,
      },
    });
    return result.count === 1;
  }

  async retry(
    work: Pick<PaymentProcessingRecord, 'id' | 'attemptCount'>,
    leaseOwner: string,
    safeFailureCode: string,
    maxAttempts: number,
  ): Promise<void> {
    const exhausted = work.attemptCount >= maxAttempts;
    const delayMs = Math.min(
      60_000,
      1_000 * 2 ** Math.max(0, work.attemptCount - 1),
    );
    await this.prisma.paymentProcessingRecord.updateMany({
      where: {
        id: work.id,
        leaseOwner,
        status: PaymentWorkStatus.LEASED,
      },
      data: exhausted
        ? {
            status: PaymentWorkStatus.MANUAL_REVIEW,
            leaseOwner: null,
            leaseExpiresAt: null,
            safeFailureCode,
          }
        : {
            status: PaymentWorkStatus.RETRYABLE,
            availableAt: new Date(Date.now() + delayMs),
            leaseOwner: null,
            leaseExpiresAt: null,
            safeFailureCode,
          },
    });
  }

  async reschedule(
    paymentId: string,
    paymentReference: string,
    kind: PaymentWorkKind,
  ): Promise<void> {
    const workKey = `${paymentReference}:${kind}`;
    const existing = await this.prisma.paymentProcessingRecord.updateMany({
      where: {
        workKey,
        paymentId,
        status: {
          in: [
            PaymentWorkStatus.COMPLETED,
            PaymentWorkStatus.MANUAL_REVIEW,
            PaymentWorkStatus.RETRYABLE,
          ],
        },
      },
      data: {
        status: PaymentWorkStatus.PENDING,
        availableAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        safeFailureCode: null,
      },
    });
    if (existing.count === 0) {
      await this.enqueue(this.prisma, paymentId, paymentReference, kind);
    }
  }
}
