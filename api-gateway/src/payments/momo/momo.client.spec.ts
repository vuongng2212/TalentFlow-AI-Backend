import { ConfigService } from '@nestjs/config';
import { MomoClient } from './momo.client';
import { MomoSignatureService } from './momo-signature.service';

describe('MomoClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the stable order/request pair to create a Wallet checkout', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ resultCode: 0, payUrl: 'https://momo.test/pay' }),
        {
          status: 200,
        },
      ),
    );
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'MOMO_API_BASE_URL'
          ? 'https://momo.test'
          : 'https://return.test',
      ),
      get: jest.fn().mockReturnValue(30000),
    } as unknown as ConfigService;
    const signatures = {
      getPartnerCode: jest.fn().mockReturnValue('PARTNER'),
      getAccessKey: jest.fn().mockReturnValue('ACCESS'),
      signCreate: jest.fn().mockReturnValue('signature'),
    } as unknown as MomoSignatureService;
    const client = new MomoClient(config, signatures);

    await expect(
      client.createCheckout({
        orderId: 'order-1',
        requestId: 'request-1',
        amount: 10000,
        orderInfo: 'Payment order-1',
      }),
    ).resolves.toMatchObject({ resultCode: 0 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://momo.test/v2/gateway/api/create',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
