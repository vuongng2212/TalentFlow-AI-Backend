import { MomoIpnController } from './momo-ipn.controller';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { SKIP_WORKSPACE_CONTEXT_KEY } from '../auth/decorators/skip-workspace-context.decorator';

describe('MomoIpnController', () => {
  it('delegates a provider callback without returning payment details', async () => {
    const handleIpn = jest.fn().mockResolvedValue(undefined);
    const controller = new MomoIpnController({ handleIpn } as never);
    const payload = {
      partnerCode: 'PARTNER',
      orderId: 'order-1',
      requestId: 'request-1',
      amount: 10000,
      orderInfo: 'Payment order-1',
      orderType: 'momo_wallet',
      transId: '1',
      resultCode: 0,
      message: 'Success',
      payType: 'qr',
      responseTime: '1',
      extraData: '',
      signature: 'a'.repeat(64),
    };

    await expect(controller.receive(payload)).resolves.toBeUndefined();
    expect(handleIpn).toHaveBeenCalledWith(payload);
  });

  it('declares the callback as public and outside workspace context', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      MomoIpnController.prototype,
      'receive',
    );
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error('Callback handler metadata target is missing');
    }
    const receive = descriptor.value as () => void;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, receive)).toBe(true);
    expect(Reflect.getMetadata(SKIP_WORKSPACE_CONTEXT_KEY, receive)).toBe(true);
  });
});
