/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { MomoBillingClient } from './momo-billing.client';
import { MomoSignatureService } from './momo-signature.service';

describe('MomoBillingClient', () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        NODE_ENV: 'test',
        MOMO_PARTNER_CODE: 'partner',
        MOMO_ACCESS_KEY: 'access',
        MOMO_SECRET_KEY: 'secret',
        MOMO_ENDPOINT_BASE_URL: 'https://test-payment.momo.vn',
        MOMO_REDIRECT_URL: 'https://app.test/redirect',
        MOMO_IPN_URL: 'https://app.test/ipn',
        MOMO_LANGUAGE: 'en',
      };
      return values[key] ?? fallback;
    }),
  };

  let client: MomoBillingClient;

  beforeEach(() => {
    client = new MomoBillingClient(
      config as unknown as ConfigService,
      new MomoSignatureService(),
    );
  });

  it('maps checkout input to the official MoMo captureWallet request shape', () => {
    const prepared = client.prepareCheckout({
      userId: 'user-1',
      planCode: 'PLUS',
      planName: 'Plus',
      amount: 99000,
      currency: 'VND',
    });

    expect(prepared.providerRequestId).toMatch(/^req-/);
    expect(prepared.providerOrderId).toMatch(/^tf-PLUS-/);
    expect(prepared.request).toEqual(
      expect.objectContaining({
        partnerCode: 'partner',
        requestType: 'captureWallet',
        ipnUrl: 'https://app.test/ipn',
        redirectUrl: 'https://app.test/redirect',
        orderId: prepared.providerOrderId,
        amount: 99000,
        lang: 'en',
        orderInfo: 'TalentFlow Plus subscription',
        requestId: prepared.providerRequestId,
        signature: expect.any(String),
      }),
    );
    expect(prepared.request.partnerClientId).toBeUndefined();
    expect(prepared.request.subscriptionInfo).toBeUndefined();
  });

  it('generates unique request and order ids for each checkout', () => {
    const first = client.prepareCheckout({
      userId: 'user-1',
      planCode: 'PLUS',
      planName: 'Plus',
      amount: 99000,
      currency: 'VND',
    });
    const second = client.prepareCheckout({
      userId: 'user-1',
      planCode: 'PLUS',
      planName: 'Plus',
      amount: 99000,
      currency: 'VND',
    });

    expect(first.providerRequestId).not.toBe(second.providerRequestId);
    expect(first.providerOrderId).not.toBe(second.providerOrderId);
  });

  it('returns a deterministic provider response in test environment', async () => {
    const prepared = client.prepareCheckout({
      userId: 'user-1',
      planCode: 'BUSINESS',
      planName: 'Business',
      amount: 499000,
      currency: 'VND',
    });

    await expect(client.submitPreparedCheckout(prepared)).resolves.toEqual(
      expect.objectContaining({
        providerRequestId: prepared.providerRequestId,
        providerOrderId: prepared.providerOrderId,
        checkoutUrl: expect.stringContaining('test-payment.momo.vn'),
        response: expect.objectContaining({
          resultCode: 0,
          orderId: prepared.providerOrderId,
        }),
      }),
    );
  });
});
