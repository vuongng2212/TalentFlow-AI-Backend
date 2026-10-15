import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentQuote } from './momo/momo.types';

interface ConfiguredPaymentItem {
  code: string;
  description: string;
  amountVnd: number;
  taxVnd: number;
  termsVersion: string;
  enabled?: boolean;
}

@Injectable()
export class PaymentCatalogService {
  constructor(private readonly config: ConfigService) {}

  resolve(payableItemCode: string): PaymentQuote {
    const catalogue = this.parseCatalogue();
    const item = catalogue.find(
      (candidate) => candidate.code === payableItemCode && candidate.enabled,
    );

    if (!item) {
      throw new BadRequestException('The payable item is unavailable');
    }

    return Object.freeze({
      code: item.code,
      description: item.description,
      amountVnd: item.amountVnd,
      taxVnd: item.taxVnd,
      totalVnd: item.amountVnd + item.taxVnd,
      termsVersion: item.termsVersion,
      quantity: 1 as const,
    });
  }

  private parseCatalogue(): ConfiguredPaymentItem[] {
    const raw = this.config.get<string>('PAYMENT_CATALOG_JSON', '[]');
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error('not an array');
      }
      return parsed as ConfiguredPaymentItem[];
    } catch {
      // Configuration validation should reject this during bootstrap. This
      // guard keeps a corrupted runtime value from becoming a quote.
      throw new BadRequestException('The payment catalogue is unavailable');
    }
  }
}
