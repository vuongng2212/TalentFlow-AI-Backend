import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  MomoCreateRequest,
  MomoIpnPayload,
  MomoQueryRequest,
} from './momo.types';

@Injectable()
export class MomoSignatureService {
  constructor(private readonly config: ConfigService) {}

  signCreate(request: Omit<MomoCreateRequest, 'signature'>): string {
    return this.sign(
      [
        ['accessKey', request.accessKey],
        ['amount', String(request.amount)],
        ['extraData', request.extraData],
        ['ipnUrl', request.ipnUrl],
        ['orderId', request.orderId],
        ['orderInfo', request.orderInfo],
        ['partnerCode', request.partnerCode],
        ['redirectUrl', request.redirectUrl],
        ['requestId', request.requestId],
        ['requestType', request.requestType],
      ],
      this.secret(),
    );
  }

  signQuery(request: Omit<MomoQueryRequest, 'signature'>): string {
    return this.sign(
      [
        ['accessKey', request.accessKey],
        ['orderId', request.orderId],
        ['partnerCode', request.partnerCode],
        ['requestId', request.requestId],
      ],
      this.secret(),
    );
  }

  verifyIpn(payload: MomoIpnPayload): boolean {
    const expected = this.sign(
      [
        ['accessKey', this.accessKey()],
        ['amount', String(payload.amount)],
        ['extraData', payload.extraData],
        ['message', payload.message],
        ['orderId', payload.orderId],
        ['orderInfo', payload.orderInfo],
        ['orderType', payload.orderType],
        ['partnerCode', payload.partnerCode],
        ['payType', payload.payType],
        ['requestId', payload.requestId],
        ['responseTime', String(payload.responseTime)],
        ['resultCode', String(payload.resultCode)],
        ['transId', String(payload.transId)],
      ],
      this.secret(),
    );
    return this.constantTimeEqual(expected, payload.signature);
  }

  // Query responses use the same result identity as the IPN in the MoMo
  // wallet flow. Keeping the verification here prevents recovery from
  // becoming a weaker state-transition channel than the public callback.
  verifyQueryResponse(payload: MomoIpnPayload): boolean {
    return this.verifyIpn(payload);
  }

  getPartnerCode(): string {
    return this.config.getOrThrow<string>('MOMO_PARTNER_CODE');
  }

  getAccessKey(): string {
    return this.accessKey();
  }

  private accessKey(): string {
    return this.config.getOrThrow<string>('MOMO_ACCESS_KEY');
  }

  private secret(): string {
    return this.config.getOrThrow<string>('MOMO_SECRET_KEY');
  }

  private sign(entries: Array<[string, string]>, secret: string): string {
    const canonical = entries
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
  }

  private constantTimeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
