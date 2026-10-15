import { PaymentWorkKind } from '@prisma/client';
import { PaymentWorkRepository } from './payment-work.repository';

describe('PaymentWorkRepository', () => {
  it('uses a deterministic work key when enqueueing durable work', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const repository = new PaymentWorkRepository({
      paymentProcessingRecord: { upsert },
    } as never);

    await repository.enqueue(
      { paymentProcessingRecord: { upsert } } as never,
      'payment-1',
      'TFP_1',
      PaymentWorkKind.CREATE_CHECKOUT,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workKey: 'TFP_1:CREATE_CHECKOUT' } }),
    );
  });

  it('claims due work under a lease before returning it to a worker', async () => {
    const record = { id: 'work-1', paymentId: 'payment-1' };
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: record.id }]),
      paymentProcessingRecord: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([record]),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
      paymentProcessingRecord: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const repository = new PaymentWorkRepository(prisma as never);

    await expect(repository.claimDue('worker-1', 60, 5)).resolves.toEqual([
      record,
    ]);
    expect(transaction.paymentProcessingRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leaseOwner: 'worker-1' }),
      }),
    );
    const query = transaction.$queryRaw.mock.calls[0][0]
      .join('')
      .replace(/\s+/g, ' ');
    expect(query).toContain('status = \'LEASED\'::"PaymentWorkStatus"');
    expect(query).toContain('lease_expires_at <=');
    expect(query).toContain('FOR UPDATE SKIP LOCKED');
  });

  it('moves an exhausted leased record to manual review', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = new PaymentWorkRepository({
      paymentProcessingRecord: { updateMany },
    } as never);

    await repository.retry(
      { id: 'work-1', attemptCount: 3 },
      'worker-1',
      'MOMO_TIMEOUT',
      3,
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'MANUAL_REVIEW' }),
      }),
    );
  });

  it('only completes work still leased by the calling worker', async () => {
    const updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const repository = new PaymentWorkRepository({
      paymentProcessingRecord: { updateMany },
    } as never);

    await expect(repository.complete('work-1', 'worker-1')).resolves.toBe(true);
    await expect(repository.complete('work-1', 'worker-2')).resolves.toBe(
      false,
    );
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'work-1',
          leaseOwner: 'worker-2',
          status: 'LEASED',
        }),
      }),
    );
  });
});
