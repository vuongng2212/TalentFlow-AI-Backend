import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MomoSignatureService } from './momo-signature.service';
import {
  MomoCreateRequest,
  MomoCreateResponse,
  MomoProviderError,
  MomoQueryRequest,
  MomoQueryResponse,
} from './momo.types';

@Injectable()
export class MomoClient {
  constructor(
    private readonly config: ConfigService,
    private readonly signatures: MomoSignatureService,
  ) {}

  async createCheckout(input: {
    orderId: string;
    requestId: string;
    amount: number;
    orderInfo: string;
  }): Promise<MomoCreateResponse> {
    const request: Omit<MomoCreateRequest, 'signature'> = {
      partnerCode: this.signatures.getPartnerCode(),
      accessKey: this.signatures.getAccessKey(),
      requestId: input.requestId,
      amount: input.amount,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      redirectUrl: this.config.getOrThrow<string>('MOMO_REDIRECT_URL'),
      ipnUrl: this.config.getOrThrow<string>('MOMO_IPN_URL'),
      requestType: 'captureWallet',
      extraData: '',
      autoCapture: true,
      lang: 'vi',
    };
    return this.post<MomoCreateResponse>('/v2/gateway/api/create', {
      ...request,
      signature: this.signatures.signCreate(request),
    });
  }

  async queryPayment(input: {
    orderId: string;
    requestId: string;
  }): Promise<MomoQueryResponse> {
    const request: Omit<MomoQueryRequest, 'signature'> = {
      partnerCode: this.signatures.getPartnerCode(),
      accessKey: this.signatures.getAccessKey(),
      requestId: input.requestId,
      orderId: input.orderId,
      lang: 'vi',
    };
    return this.post<MomoQueryResponse>('/v2/gateway/api/query', {
      ...request,
      signature: this.signatures.signQuery(request),
    });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const baseUrl = this.config
      .getOrThrow<string>('MOMO_API_BASE_URL')
      .replace(/\/$/, '');
    const timeoutMs = this.config.get<number>('MOMO_REQUEST_TIMEOUT_MS', 30000);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new MomoProviderError('MOMO_PROVIDER_REJECTED');
      }

      const payload: unknown = await response.json();
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('resultCode' in payload)
      ) {
        throw new MomoProviderError('MOMO_INVALID_RESPONSE');
      }
      return payload as T;
    } catch (error) {
      if (error instanceof MomoProviderError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new MomoProviderError('MOMO_TIMEOUT');
      }
      throw new MomoProviderError('MOMO_NETWORK_ERROR');
    }
  }
}
