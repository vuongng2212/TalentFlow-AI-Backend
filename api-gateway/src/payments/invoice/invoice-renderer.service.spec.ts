import { InvoiceRendererService } from './invoice-renderer.service';

describe('InvoiceRendererService', () => {
  it('renders a deterministic commercial-receipt PDF buffer', async () => {
    const renderer = new InvoiceRendererService();
    const input = {
      invoiceReference: 'TFI_123',
      issuedAt: new Date('2026-09-18T00:00:00.000Z'),
      issuer: { name: 'TalentFlow AI', address: 'Hanoi' },
      payer: { name: 'Workspace' },
      item: {
        code: 'DEMO',
        description: 'Demo service',
        quantity: 1,
        termsVersion: 'v1',
      },
      subtotalVnd: 10000,
      taxVnd: 0,
      totalVnd: 10000,
      currency: 'VND',
    };
    const result = await renderer.render(input);
    const retriedResult = await renderer.render(input);

    expect(result.subarray(0, 4).toString()).toBe('%PDF');
    expect(retriedResult).toEqual(result);
  });
});
