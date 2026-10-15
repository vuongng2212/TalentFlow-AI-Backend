import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { MomoSignatureService } from './momo-signature.service';

describe('MomoSignatureService', () => {
  const config = {
    getOrThrow: jest.fn(
      (key: string) =>
        ({
          MOMO_PARTNER_CODE: 'PARTNER',
          MOMO_ACCESS_KEY: 'ACCESS',
          MOMO_SECRET_KEY: 'secret-for-tests',
        })[key],
    ),
  } as unknown as ConfigService;

  it('signs the documented fixed create field sequence', () => {
    const service = new MomoSignatureService(config);
    const request = {
      partnerCode: 'PARTNER',
      accessKey: 'ACCESS',
      requestId: 'request-1',
      amount: 10000,
      orderId: 'order-1',
      orderInfo: 'Payment order-1',
      redirectUrl: 'https://app.test/return',
      ipnUrl: 'https://api.test/ipn',
      requestType: 'captureWallet' as const,
      extraData: '',
      autoCapture: true,
      lang: 'vi' as const,
    };
    const canonical =
      'accessKey=ACCESS&amount=10000&extraData=&ipnUrl=https://api.test/ipn&orderId=order-1&orderInfo=Payment order-1&partnerCode=PARTNER&redirectUrl=https://app.test/return&requestId=request-1&requestType=captureWallet';

    expect(service.signCreate(request)).toBe(
      createHmac('sha256', 'secret-for-tests').update(canonical).digest('hex'),
    );
  });

  it('rejects signatures with a different length before timing-safe comparison', () => {
    const service = new MomoSignatureService(config);
    expect(
      service.verifyIpn({
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
        signature: 'short',
      }),
    ).toBe(false);
  });
});
