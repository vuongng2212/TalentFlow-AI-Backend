import {
  PaymentIdempotencyOperation,
  PaymentResultDisposition,
  PaymentStatus,
  PaymentWorkKind,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

const quote = {
  code: 'DEMO_SERVICE',
  description: 'Demo service',
  amountVnd: 10000,
  taxVnd: 0,
  totalVnd: 10000,
  termsVersion: 'v1',
  quantity: 1 as const,
};

const projectedPayment = {
  id: 'payment-1',
  reference: 'TFP_1',
  requesterId: 'user-1',
  workspaceId: 'workspace-1',
  idempotencyOperation: PaymentIdempotencyOperation.INITIATE_MOMO_CHECKOUT,
  idempotencyKeyDigest: 'a'.repeat(64),
  idempotencyRequestFingerprint: 'b'.repeat(64),
  momoOrderId: 'TFP_1',
  momoRequestId: 'request-1',
  amountVnd: 10000,
  currency: 'VND',
  status: PaymentStatus.PENDING,
  checkoutStatus: 'READY',
  checkoutUrl: 'https://momo.test/checkout',
  expiresAt: null,
  momoTransactionId: null,
  chargeSnapshot: quote,
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
  updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  invoice: null,
};

const validIpn = {
  partnerCode: 'PARTNER',
  orderId: 'TFP_1',
  requestId: 'request-1',
  amount: 10000,
  orderInfo: 'TalentFlow payment TFP_1',
  orderType: 'momo_wallet',
  transId: '1',
  resultCode: 0,
  message: 'Success',
  payType: 'qr',
  responseTime: '1',
  extraData: '',
  signature: 'valid',
};

describe('PaymentsService', () => {
  const createService = (prisma: Record<string, unknown>, overrides = {}) => {
    const catalogue = { resolve: jest.fn().mockReturnValue(quote) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const work = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      reschedule: jest.fn().mockResolvedValue(undefined),
    };
    const signatures = {
      verifyIpn: jest.fn().mockReturnValue(false),
      verifyQueryResponse: jest.fn().mockReturnValue(true),
      getPartnerCode: jest.fn().mockReturnValue('PARTNER'),
    };
    const metrics = { recordPaymentEvent: jest.fn() };
    const storage = { createDownloadUrl: jest.fn() };
    const recovery = {
      createCheckoutForPayment: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new PaymentsService(
        prisma as never,
        catalogue as never,
        audit as never,
        work as never,
        signatures as never,
        metrics as never,
        storage as never,
        recovery as never,
      ),
      catalogue,
      audit,
      work,
      signatures,
      metrics,
      recovery,
      ...overrides,
    };
  };

  it('creates a server-priced payment with digest-only idempotency fields', async () => {
    const transaction = {
      workspaceMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm-1' }),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(projectedPayment),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
      payment: { findUnique: jest.fn().mockResolvedValue(projectedPayment) },
    };
    const { service, work, recovery } = createService(prisma);

    await expect(
      service.createPayment(
        'workspace-1',
        'user-1',
        'DEMO_SERVICE',
        'payment-key-123',
      ),
    ).resolves.toMatchObject({
      reference: 'TFP_1',
      amountVnd: 10000,
      currency: 'VND',
    });

    expect(transaction.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountVnd: quote.totalVnd,
          currency: 'VND',
          chargeSnapshot: quote,
          idempotencyOperation:
            PaymentIdempotencyOperation.INITIATE_MOMO_CHECKOUT,
          idempotencyKeyDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
          idempotencyRequestFingerprint:
            expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(work.enqueue).toHaveBeenCalledWith(
      transaction,
      'payment-1',
      'TFP_1',
      PaymentWorkKind.CREATE_CHECKOUT,
    );
    expect(recovery.createCheckoutForPayment).toHaveBeenCalledWith('payment-1');
  });

  it('retries a serializable initiation conflict before accepting one payment', async () => {
    const transaction = {
      workspaceMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm-1' }),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(projectedPayment),
      },
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockRejectedValueOnce({ code: 'P2034' })
        .mockImplementationOnce(
          (callback: (client: typeof transaction) => unknown) =>
            callback(transaction),
        ),
      payment: { findUnique: jest.fn().mockResolvedValue(projectedPayment) },
    };
    const { service } = createService(prisma);
    jest.spyOn(service as never, 'wait').mockResolvedValueOnce(undefined);

    await expect(
      service.createPayment(
        'workspace-1',
        'user-1',
        'DEMO_SERVICE',
        'payment-key-456',
      ),
    ).resolves.toMatchObject({ reference: 'TFP_1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('rejects a same-key initiation bound to a different trusted quote', async () => {
    const transaction = {
      workspaceMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'member-1' }),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          ...projectedPayment,
          idempotencyRequestFingerprint: 'different-fingerprint',
        }),
      },
    };
    const { service } = createService({
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    });

    await expect(
      service.createPayment(
        'workspace-1',
        'user-1',
        'DEMO_SERVICE',
        'same-key-123',
      ),
    ).rejects.toThrow('different payment intent');

    expect(transaction.payment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requesterId_workspaceId_idempotencyOperation_idempotencyKeyDigest:
            expect.objectContaining({
              idempotencyOperation:
                PaymentIdempotencyOperation.INITIATE_MOMO_CHECKOUT,
            }),
        }),
      }),
    );
  });

  it('records an invalid IPN as rejection evidence without a payment transition', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const transaction = {
      paymentProviderResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const { service } = createService({
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    });

    await service.handleIpn({
      partnerCode: 'PARTNER',
      orderId: 'TFP_order',
      requestId: 'request-1',
      amount: 10000,
      orderInfo: 'TalentFlow payment TFP_order',
      orderType: 'momo_wallet',
      transId: '1',
      resultCode: 0,
      message: 'Success',
      payType: 'qr',
      responseTime: '1',
      extraData: '',
      signature: 'invalid',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          disposition: PaymentResultDisposition.REJECTED,
          reasonCode: 'INVALID_SIGNATURE',
        }),
      }),
    );
  });

  it('retains a valid callback for an unknown order as rejected evidence', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const transaction = {
      paymentProviderResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const { service, signatures } = createService({
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    });
    signatures.verifyIpn.mockReturnValue(true);

    await service.handleIpn(validIpn);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          disposition: PaymentResultDisposition.REJECTED,
          reasonCode: 'UNKNOWN_PAYMENT',
        }),
      }),
    );
  });

  it('applies a verified success once and schedules only its durable outcome', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      paymentProviderResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(projectedPayment),
        updateMany,
      },
    };
    const { service, work, signatures } = createService({
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    });
    signatures.verifyIpn.mockReturnValue(true);

    await service.handleIpn(validIpn);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-1', status: PaymentStatus.PENDING },
        data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }),
      }),
    );
    expect(work.enqueue).toHaveBeenCalledWith(
      transaction,
      'payment-1',
      'TFP_1',
      PaymentWorkKind.APPLY_SUCCESS,
    );
  });

  it('does not collapse a tampered receipt into a matching verified duplicate', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue(undefined);
    const transaction = {
      paymentProviderResult: { findUnique, create },
      payment: {
        findUnique: jest.fn().mockResolvedValue(projectedPayment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { service, signatures } = createService({
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    });
    signatures.verifyIpn.mockReturnValueOnce(true).mockReturnValueOnce(false);

    await service.handleIpn(validIpn);
    await service.handleIpn({ ...validIpn, signature: 'tampered' });

    expect(findUnique.mock.calls[0][0].where.semanticKey).not.toEqual(
      findUnique.mock.calls[1][0].where.semanticKey,
    );
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          disposition: PaymentResultDisposition.REJECTED,
          reasonCode: 'INVALID_SIGNATURE',
        }),
      }),
    );
  });

  it('retains a verified payment mismatch without changing the pending payment', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const updateMany = jest.fn();
    const transaction = {
      paymentProviderResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(projectedPayment),
        updateMany,
      },
    };
    const { service, signatures, work } = createService({
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    });
    signatures.verifyIpn.mockReturnValue(true);

    await service.handleIpn({ ...validIpn, amount: 15000 });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          disposition: PaymentResultDisposition.REJECTED,
          reasonCode: 'PAYMENT_MISMATCH',
        }),
      }),
    );
    expect(updateMany).not.toHaveBeenCalled();
    expect(work.enqueue).not.toHaveBeenCalled();
  });

  it('records a valid failure as a terminal failure work item', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      paymentProviderResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(projectedPayment),
        updateMany,
      },
    };
    const { service, signatures, work } = createService({
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    });
    signatures.verifyIpn.mockReturnValue(true);

    await service.handleIpn({ ...validIpn, resultCode: 49 });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.CANCELLED }),
      }),
    );
    expect(work.enqueue).toHaveBeenCalledWith(
      transaction,
      'payment-1',
      'TFP_1',
      PaymentWorkKind.APPLY_FAILURE,
    );
  });

  it('increments a duplicate receipt without enqueuing another effect', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const transaction = {
      paymentProviderResult: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'receipt-1', paymentId: 'payment-1' }),
        update,
      },
    };
    const { service, work } = createService({
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    });

    await service.handleIpn(validIpn);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ duplicateCount: { increment: 1 } }),
      }),
    );
    expect(work.enqueue).not.toHaveBeenCalled();
  });

  it('keeps processing provider results pending and queues reconciliation', async () => {
    const transaction = {
      paymentProviderResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
      payment: { findUnique: jest.fn().mockResolvedValue(projectedPayment) },
    };
    const { service, work, signatures } = createService({
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    });
    signatures.verifyIpn.mockReturnValue(true);

    await service.handleIpn({ ...validIpn, resultCode: 10 });

    expect(work.enqueue).toHaveBeenCalledWith(
      transaction,
      'payment-1',
      'TFP_1',
      PaymentWorkKind.RECONCILE_MOMO,
    );
  });

  it('returns a workspace-scoped cursor page without checkout URLs', async () => {
    const second = {
      ...projectedPayment,
      id: 'payment-2',
      reference: 'TFP_2',
    };
    const findMany = jest.fn().mockResolvedValue([projectedPayment, second]);
    const { service } = createService({ payment: { findMany } });

    await expect(
      service.listPayments('workspace-1', { limit: 1 }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          reference: 'TFP_1',
          checkoutStatus: 'READY',
        }),
      ],
      nextCursor: 'payment-1',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'workspace-1', status: undefined },
        take: 2,
      }),
    );
  });

  it('projects audit and provider history without raw callback material', async () => {
    const payment = {
      ...projectedPayment,
      auditEvents: [
        {
          action: 'STATE_CHANGED',
          actorKind: 'MOMO',
          previousState: PaymentStatus.PENDING,
          newState: PaymentStatus.SUCCEEDED,
          reasonCode: 'MOMO_RESULT_0',
          occurredAt: new Date('2026-09-18T00:01:00.000Z'),
          rawPayload: { shouldNot: 'be returned' },
        },
      ],
      providerResults: [
        {
          partnerCode: 'PARTNER',
          orderId: 'TFP_1',
          requestId: 'request-1',
          momoTransactionId: BigInt(901),
          resultCode: 0,
          disposition: PaymentResultDisposition.VERIFIED,
          reasonCode: 'MOMO_RESULT_0',
          receivedAt: new Date('2026-09-18T00:01:00.000Z'),
          duplicateCount: 0,
          safePayload: { signature: 'must-not-escape' },
        },
      ],
    };
    const { service } = createService({
      payment: { findFirst: jest.fn().mockResolvedValue(payment) },
    });

    const result = await service.getPayment('workspace-1', 'TFP_1');

    expect(result.auditEvents[0]).toEqual(
      expect.objectContaining({ action: 'STATE_CHANGED' }),
    );
    expect(result.auditEvents[0]).not.toHaveProperty('rawPayload');
    expect(result.providerResults[0]).toEqual(
      expect.objectContaining({ providerTransactionReference: '901' }),
    );
    expect(result.providerResults[0]).not.toHaveProperty('safePayload');
  });

  it('queues one reconciliation for an eligible owner without opening another payment', async () => {
    const pendingPayment = {
      ...projectedPayment,
      checkoutStatus: 'UNKNOWN',
      checkoutUrl: null,
    };
    const { service, audit, work } = createService({
      payment: {
        findFirst: jest.fn().mockResolvedValue(pendingPayment),
        findUnique: jest.fn().mockResolvedValue(pendingPayment),
      },
      workspaceMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm-1' }),
      },
    });

    await expect(
      service.scheduleReconciliation('workspace-1', 'user-1', 'TFP_1'),
    ).resolves.toMatchObject({ reference: 'TFP_1' });
    expect(work.reschedule).toHaveBeenCalledWith(
      'payment-1',
      'TFP_1',
      PaymentWorkKind.RECONCILE_MOMO,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reasonCode: 'RECONCILIATION_SCHEDULED' }),
    );
  });
});
