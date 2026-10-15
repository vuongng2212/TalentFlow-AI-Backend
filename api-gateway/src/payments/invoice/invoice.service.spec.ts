import { ConfigService } from '@nestjs/config';
import { InvoiceDocumentStatus, PaymentStatus } from '@prisma/client';
import { InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  const successfulPayment = {
    id: 'payment-1',
    reference: 'TFP_1',
    status: PaymentStatus.SUCCEEDED,
    currency: 'VND',
    workspace: { name: 'Workspace' },
    requester: { id: 'user-1' },
    invoice: null,
    chargeSnapshot: {
      code: 'DEMO_SERVICE',
      description: 'Demo service',
      amountVnd: 10000,
      taxVnd: 0,
      totalVnd: 10000,
      quantity: 1,
      termsVersion: 'v1',
    },
  };

  it('issues exactly one receipt from the persisted successful-payment snapshot', async () => {
    const invoice = {
      id: 'invoice-1',
      invoiceReference: 'TFI_1',
      documentStatus: InvoiceDocumentStatus.PENDING_RENDER,
    };
    const transaction = {
      payment: { findUnique: jest.fn().mockResolvedValue(successfulPayment) },
      invoice: { create: jest.fn().mockResolvedValue(invoice) },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const work = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new InvoiceService(
      prisma as never,
      audit as never,
      work as never,
      {} as never,
      {} as never,
      {
        get: jest.fn((key: string) =>
          key === 'PAYMENT_RECEIPT_ISSUER_NAME' ? 'TalentFlow AI' : 'Hanoi',
        ),
      } as unknown as ConfigService,
      {} as never,
    );

    await expect(service.issueForPayment('payment-1')).resolves.toEqual(
      invoice,
    );
    expect(transaction.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentId: 'payment-1' }),
      }),
    );
    expect(work.enqueue).toHaveBeenCalledWith(
      transaction,
      'payment-1',
      'TFP_1',
      'RENDER_INVOICE',
    );
  });

  it('refuses receipt issuance for a payment that is not successful', async () => {
    const transaction = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          ...successfulPayment,
          status: PaymentStatus.PENDING,
        }),
      },
    };
    const service = new InvoiceService(
      {
        $transaction: jest.fn(
          (callback: (client: typeof transaction) => unknown) =>
            callback(transaction),
        ),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.issueForPayment('payment-1')).rejects.toThrow(
      'only be issued for a successful payment',
    );
  });

  it('returns the immutable existing receipt without creating another one', async () => {
    const existingInvoice = {
      id: 'invoice-1',
      invoiceReference: 'TFI_1',
      documentStatus: InvoiceDocumentStatus.PENDING_RENDER,
    };
    const transaction = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          ...successfulPayment,
          invoice: existingInvoice,
        }),
      },
      invoice: { create: jest.fn() },
    };
    const work = { enqueue: jest.fn() };
    const service = new InvoiceService(
      {
        $transaction: jest.fn(
          (callback: (client: typeof transaction) => unknown) =>
            callback(transaction),
        ),
      } as never,
      {} as never,
      work as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.issueForPayment('payment-1')).resolves.toEqual(
      existingInvoice,
    );
    expect(transaction.invoice.create).not.toHaveBeenCalled();
    expect(work.enqueue).not.toHaveBeenCalled();
  });

  it('marks a failed render retryable without changing the successful payment', async () => {
    const invoice = {
      id: 'invoice-1',
      invoiceReference: 'TFI_1',
      paymentId: 'payment-1',
      documentStatus: InvoiceDocumentStatus.PENDING_RENDER,
      issuedAt: new Date('2026-09-18T00:00:00.000Z'),
      issuerSnapshot: { name: 'TalentFlow AI', address: 'Hanoi' },
      payerSnapshot: { name: 'Workspace' },
      lineItemsSnapshot: successfulPayment.chargeSnapshot,
      subtotalVnd: 10000,
      taxVnd: 0,
      totalVnd: 10000,
      currency: 'VND',
      payment: successfulPayment,
    };
    const update = jest.fn().mockResolvedValue(invoice);
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const metrics = { recordInvoiceRender: jest.fn() };
    const service = new InvoiceService(
      {
        invoice: {
          findUnique: jest.fn().mockResolvedValue(invoice),
          update,
        },
      } as never,
      audit as never,
      {} as never,
      {
        render: jest.fn().mockRejectedValue(new Error('storage unavailable')),
      },
      {} as never,
      {} as never,
      metrics as never,
    );

    await expect(service.renderInvoice(invoice.id)).rejects.toThrow(
      'storage unavailable',
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { documentStatus: InvoiceDocumentStatus.RETRYABLE },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reasonCode: 'INVOICE_RENDER_RETRYABLE' }),
    );
  });
});
