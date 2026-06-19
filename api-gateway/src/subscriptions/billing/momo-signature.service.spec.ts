import { createHmac } from 'crypto';
import { MomoSignatureService } from './momo-signature.service';

describe('MomoSignatureService', () => {
  const service = new MomoSignatureService();

  it('signs create subscription requests with the MoMo field order', () => {
    const request = {
      partnerCode: 'partner',
      requestType: 'subscription' as const,
      ipnUrl: 'https://app.test/ipn',
      redirectUrl: 'https://app.test/redirect',
      orderId: 'order-1',
      amount: 99000,
      lang: 'en' as const,
      orderInfo: 'TalentFlow Plus subscription',
      requestId: 'request-1',
      partnerClientId: 'user-1',
      extraData: '',
      subscriptionInfo: {
        partnerSubsId: 'order-1',
        name: 'TalentFlow Plus',
        subsOwner: 'user-1',
        type: 'VARIABLE' as const,
        recurringAmount: 99000,
        nextPaymentDate: '2026-07-12',
        expiryDate: '2027-06-12',
        frequency: 'MONTHLY' as const,
      },
    };
    const raw =
      'accessKey=access&amount=99000&extraData=&ipnUrl=https://app.test/ipn&orderId=order-1&orderInfo=TalentFlow Plus subscription&partnerClientId=user-1&partnerCode=partner&redirectUrl=https://app.test/redirect&requestId=request-1&requestType=subscription';

    expect(service.signCreateSubscription('access', 'secret', request)).toBe(
      createHmac('sha256', 'secret').update(raw).digest('hex'),
    );
  });

  it('verifies payment result signatures with callback fields included', () => {
    const result = {
      partnerCode: 'partner',
      requestId: 'request-1',
      orderId: 'order-1',
      amount: 99000,
      orderInfo: 'TalentFlow Plus subscription',
      orderType: 'momo_wallet',
      partnerClientId: 'user-1',
      callbackToken: 'callback',
      transId: 'trans-1',
      resultCode: 0,
      message: 'Successful.',
      payType: 'webApp',
      responseTime: 1,
      extraData: '',
      signature: '',
    };
    result.signature = service.signPaymentResult('access', 'secret', result);

    expect(service.verifyPaymentResult('access', 'secret', result)).toBe(true);
    expect(
      service.verifyPaymentResult('access', 'secret', {
        ...result,
        amount: 1,
      }),
    ).toBe(false);
  });
});
