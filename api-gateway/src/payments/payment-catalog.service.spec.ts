import { ConfigService } from '@nestjs/config';
import { PaymentCatalogService } from './payment-catalog.service';

describe('PaymentCatalogService', () => {
  const catalogue = JSON.stringify([
    {
      code: 'DEMO_SERVICE',
      description: 'Demo service',
      amountVnd: 10000,
      taxVnd: 1000,
      termsVersion: '2026-09',
      enabled: true,
    },
  ]);

  it('returns an immutable server-owned VND quote', () => {
    const config = {
      get: jest.fn().mockReturnValue(catalogue),
    } as unknown as ConfigService;
    const service = new PaymentCatalogService(config);

    expect(service.resolve('DEMO_SERVICE')).toEqual({
      code: 'DEMO_SERVICE',
      description: 'Demo service',
      amountVnd: 10000,
      taxVnd: 1000,
      totalVnd: 11000,
      termsVersion: '2026-09',
      quantity: 1,
    });
  });

  it('rejects an unavailable code instead of accepting a caller quote', () => {
    const config = {
      get: jest.fn().mockReturnValue(catalogue),
    } as unknown as ConfigService;
    const service = new PaymentCatalogService(config);

    expect(() => service.resolve('CLIENT_PRICE_1')).toThrow('unavailable');
  });
});
