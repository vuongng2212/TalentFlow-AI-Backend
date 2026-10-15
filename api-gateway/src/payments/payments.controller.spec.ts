import { PaymentsController } from './payments.controller';
import { WorkspaceMemberRole } from '@prisma/client';
import { WORKSPACE_ROLES_KEY } from '../auth/decorators/workspace-roles.decorator';

describe('PaymentsController', () => {
  it('returns 202 when durable checkout recovery is pending', async () => {
    const payments = {
      createPayment: jest.fn().mockResolvedValue({ checkoutStatus: 'UNKNOWN' }),
    };
    const context = {
      getWorkspaceId: jest.fn().mockReturnValue('workspace-1'),
    };
    const controller = new PaymentsController(
      payments as never,
      context as never,
    );
    const response = { status: jest.fn() };

    await controller.create(
      { id: 'user-1' },
      'idempotency-key',
      { payableItemCode: 'DEMO_SERVICE' },
      response as never,
    );

    expect(response.status).toHaveBeenCalledWith(202);
  });

  it('requires workspace owner or administrator metadata for checkout creation', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      PaymentsController.prototype,
      'create',
    );
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error('Checkout handler metadata target is missing');
    }
    const create = descriptor.value as () => void;
    expect(Reflect.getMetadata(WORKSPACE_ROLES_KEY, create)).toEqual([
      WorkspaceMemberRole.OWNER,
      WorkspaceMemberRole.ADMIN,
    ]);
  });

  it('forwards only the server-resolved payment inputs and returns 201 when ready', async () => {
    const payments = {
      createPayment: jest.fn().mockResolvedValue({ checkoutStatus: 'READY' }),
    };
    const context = {
      getWorkspaceId: jest.fn().mockReturnValue('workspace-1'),
    };
    const controller = new PaymentsController(
      payments as never,
      context as never,
    );
    const response = { status: jest.fn() };

    await controller.create(
      { id: 'owner-1' },
      'idempotency-key',
      { payableItemCode: 'DEMO_SERVICE' },
      response as never,
    );

    expect(payments.createPayment).toHaveBeenCalledWith(
      'workspace-1',
      'owner-1',
      'DEMO_SERVICE',
      'idempotency-key',
    );
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('uses active workspace context for member history and owner reconciliation', async () => {
    const payments = {
      listPayments: jest.fn().mockResolvedValue({ items: [] }),
      scheduleReconciliation: jest
        .fn()
        .mockResolvedValue({ reference: 'TFP_1' }),
    };
    const context = {
      getWorkspaceId: jest.fn().mockReturnValue('workspace-1'),
    };
    const controller = new PaymentsController(
      payments as never,
      context as never,
    );

    await controller.list({ status: undefined, limit: 10 });
    await controller.reconcile({ id: 'owner-1' }, 'TFP_1');

    expect(payments.listPayments).toHaveBeenCalledWith('workspace-1', {
      status: undefined,
      limit: 10,
    });
    expect(payments.scheduleReconciliation).toHaveBeenCalledWith(
      'workspace-1',
      'owner-1',
      'TFP_1',
    );
  });

  it('returns 202 for a receipt that is still rendering and 200 for a signed URL', async () => {
    const payments = {
      getInvoiceDownload: jest
        .fn()
        .mockResolvedValueOnce({ documentStatus: 'RETRYABLE' })
        .mockResolvedValueOnce({
          invoiceReference: 'TFI_1',
          downloadUrl: 'https://download.test/receipt',
        }),
    };
    const context = {
      getWorkspaceId: jest.fn().mockReturnValue('workspace-1'),
    };
    const controller = new PaymentsController(
      payments as never,
      context as never,
    );
    const renderingResponse = { status: jest.fn() };
    const readyResponse = { status: jest.fn() };

    await expect(
      controller.downloadInvoice('TFP_1', renderingResponse as never),
    ).resolves.toEqual({ documentStatus: 'RETRYABLE' });
    await expect(
      controller.downloadInvoice('TFP_1', readyResponse as never),
    ).resolves.toEqual({
      invoiceReference: 'TFI_1',
      downloadUrl: 'https://download.test/receipt',
    });

    expect(renderingResponse.status).toHaveBeenCalledWith(202);
    expect(readyResponse.status).not.toHaveBeenCalled();
  });
});
