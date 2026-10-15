import { ConfigService } from '@nestjs/config';
import {
  PaymentCheckoutStatus,
  PaymentStatus,
  PaymentWorkKind,
} from '@prisma/client';
import { MomoProviderError } from './momo/momo.types';
import { PaymentRecoveryService } from './payment-recovery.service';

describe('PaymentRecoveryService', () => {
  it('uses the payment-stable MoMo references and records a ready checkout', async () => {
    const payment = {
      id: 'payment-1',
      reference: 'TFP_1',
      momoOrderId: 'TFP_1',
      momoRequestId: 'request-1',
      amountVnd: 10000,
      checkoutStatus: PaymentCheckoutStatus.NOT_REQUESTED,
    };
    const update = jest.fn().mockResolvedValue(payment);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = { payment: { update }, audit: true };
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        update,
        updateMany,
      },
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };
    const momo = {
      createCheckout: jest.fn().mockResolvedValue({
        resultCode: 0,
        payUrl: 'https://momo.test/pay',
      }),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new PaymentRecoveryService(
      { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService,
      prisma as never,
      momo as never,
      { claimDue: jest.fn(), complete: jest.fn(), retry: jest.fn() } as never,
      audit as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.createCheckoutForPayment(payment.id);

    expect(momo.createCheckout).toHaveBeenCalledWith({
      orderId: payment.momoOrderId,
      requestId: payment.momoRequestId,
      amount: payment.amountVnd,
      orderInfo: 'TalentFlow payment TFP_1',
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checkoutStatus: PaymentCheckoutStatus.REQUESTING,
        }),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checkoutStatus: PaymentCheckoutStatus.READY,
        }),
      }),
    );
  });

  it('keeps the durable checkout work recoverable when MoMo times out', async () => {
    const payment = {
      id: 'payment-1',
      reference: 'TFP_1',
      momoOrderId: 'TFP_1',
      momoRequestId: 'request-1',
      amountVnd: 10000,
      checkoutStatus: PaymentCheckoutStatus.NOT_REQUESTED,
    };
    const update = jest.fn().mockResolvedValue(payment);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new PaymentRecoveryService(
      { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService,
      {
        payment: {
          findUnique: jest.fn().mockResolvedValue(payment),
          update,
          updateMany,
        },
      } as never,
      {
        createCheckout: jest
          .fn()
          .mockRejectedValue(new MomoProviderError('MOMO_TIMEOUT')),
      } as never,
      {} as never,
      audit as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.createCheckoutForPayment(payment.id)).rejects.toThrow(
      'MOMO_TIMEOUT',
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { checkoutStatus: PaymentCheckoutStatus.UNKNOWN },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reasonCode: 'MOMO_TIMEOUT' }),
    );
  });

  it('does not open a second checkout when another worker already claimed it', async () => {
    const payment = {
      id: 'payment-1',
      reference: 'TFP_1',
      momoOrderId: 'TFP_1',
      momoRequestId: 'request-1',
      amountVnd: 10000,
      checkoutStatus: PaymentCheckoutStatus.NOT_REQUESTED,
    };
    const momo = { createCheckout: jest.fn() };
    const service = new PaymentRecoveryService(
      { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService,
      {
        payment: {
          findUnique: jest.fn().mockResolvedValue(payment),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      } as never,
      momo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createCheckoutForPayment(payment.id),
    ).resolves.toBeUndefined();
    expect(momo.createCheckout).not.toHaveBeenCalled();
  });

  it('reuses stable provider references when reconciling a pending payment', async () => {
    const payment = {
      id: 'payment-1',
      reference: 'TFP_1',
      momoOrderId: 'TFP_1',
      momoRequestId: 'request-1',
      status: PaymentStatus.PENDING,
    };
    const queryResult = { resultCode: 10 };
    const momo = { queryPayment: jest.fn().mockResolvedValue(queryResult) };
    const payments = { handleVerifiedQueryResult: jest.fn() };
    const audit = { record: jest.fn() };
    const service = new PaymentRecoveryService(
      { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService,
      {
        payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      } as never,
      momo as never,
      {} as never,
      audit as never,
      {} as never,
      {} as never,
      payments as never,
    );

    await service['reconcilePayment'](payment.id);

    expect(momo.queryPayment).toHaveBeenCalledWith({
      orderId: payment.momoOrderId,
      requestId: payment.momoRequestId,
    });
    expect(payments.handleVerifiedQueryResult).toHaveBeenCalledWith(
      queryResult,
    );
  });

  it('keeps a failed reconciliation durable and bounded for retry', async () => {
    const payment = {
      id: 'payment-1',
      reference: 'TFP_1',
      momoOrderId: 'TFP_1',
      momoRequestId: 'request-1',
      status: PaymentStatus.PENDING,
    };
    const record = {
      id: 'work-1',
      paymentId: payment.id,
      kind: PaymentWorkKind.RECONCILE_MOMO,
      attemptCount: 2,
    };
    const work = {
      claimDue: jest.fn().mockResolvedValue([record]),
      retry: jest.fn().mockResolvedValue(undefined),
      complete: jest.fn(),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const metrics = { recordPaymentWork: jest.fn() };
    const service = new PaymentRecoveryService(
      {
        get: jest.fn((key: string, fallback?: number) => {
          if (key === 'PAYMENT_RECOVERY_LEASE_SECONDS') return 60;
          if (key === 'PAYMENT_RECOVERY_MAX_ATTEMPTS') return 3;
          return fallback;
        }),
      } as unknown as ConfigService,
      {
        payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      } as never,
      {
        queryPayment: jest
          .fn()
          .mockRejectedValue(new MomoProviderError('MOMO_TIMEOUT')),
      } as never,
      work as never,
      audit as never,
      {} as never,
      metrics as never,
      {} as never,
    );

    await service.runDueWork();

    expect(work.retry).toHaveBeenCalledWith(
      record,
      expect.stringMatching(/^payment-worker-/),
      'MOMO_TIMEOUT',
      3,
    );
    expect(work.complete).not.toHaveBeenCalled();
  });

  it('leases and marks one successful local outcome on the payment without entitlement mutation', async () => {
    const payment = {
      id: 'payment-1',
      reference: 'TFP_1',
      workspaceId: 'workspace-1',
      status: PaymentStatus.SUCCEEDED,
      outcomeRecordedAt: null,
      momoTransactionId: BigInt(901),
      chargeSnapshot: {},
    };
    const transaction = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const work = {
      claimDue: jest.fn().mockResolvedValue([
        {
          id: 'work-1',
          paymentId: payment.id,
          kind: PaymentWorkKind.APPLY_SUCCESS,
          attemptCount: 1,
        },
      ]),
      complete: jest.fn().mockResolvedValue(true),
      enqueue: jest.fn().mockResolvedValue(undefined),
      retry: jest.fn(),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const metrics = { recordPaymentWork: jest.fn() };
    const service = new PaymentRecoveryService(
      { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService,
      {
        $transaction: jest.fn(
          (callback: (client: typeof transaction) => unknown) =>
            callback(transaction),
        ),
      } as never,
      {} as never,
      work as never,
      audit as never,
      {} as never,
      metrics as never,
      {} as never,
    );

    await service.runDueWork();

    expect(transaction.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: payment.id,
          outcomeRecordedAt: null,
          status: PaymentStatus.SUCCEEDED,
        },
        data: { outcomeRecordedAt: expect.any(Date) },
      }),
    );
    expect(work.enqueue).toHaveBeenCalledWith(
      transaction,
      payment.id,
      payment.reference,
      PaymentWorkKind.ISSUE_INVOICE,
    );
    expect(work.complete).toHaveBeenCalledWith('work-1', expect.any(String));
  });
});
