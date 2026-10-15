import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentAuditAction,
  PaymentAuditActorKind,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuditClient =
  | Pick<PrismaService, 'paymentAuditEvent'>
  | Prisma.TransactionClient;

export interface PaymentAuditInput {
  paymentId: string;
  action: PaymentAuditAction;
  actorKind: PaymentAuditActorKind;
  invoiceId?: string;
  previousState?: PaymentStatus;
  newState?: PaymentStatus;
  correlationId?: string;
  reasonCode?: string;
}

@Injectable()
export class PaymentAuditService {
  private readonly logger = new Logger(PaymentAuditService.name);

  async record(client: AuditClient, input: PaymentAuditInput): Promise<void> {
    await client.paymentAuditEvent.create({
      data: {
        paymentId: input.paymentId,
        invoiceId: input.invoiceId,
        action: input.action,
        actorKind: input.actorKind,
        previousState: input.previousState,
        newState: input.newState,
        correlationId: input.correlationId,
        reasonCode: input.reasonCode,
      },
    });
    this.logger.log({
      event: 'payment_audit',
      paymentId: input.paymentId,
      invoiceId: input.invoiceId,
      action: input.action,
      actorKind: input.actorKind,
      reasonCode: input.reasonCode,
    });
  }
}
