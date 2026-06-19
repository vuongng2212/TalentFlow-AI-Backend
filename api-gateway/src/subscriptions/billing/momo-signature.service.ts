import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  MomoCreateSubscriptionRequest,
  MomoPaymentResult,
} from './momo.types';

type SignatureValue = string | number | undefined | null;

@Injectable()
export class MomoSignatureService {
  signCreateSubscription(
    accessKey: string,
    secretKey: string,
    request: Omit<MomoCreateSubscriptionRequest, 'signature'>,
  ): string {
    const entries: [string, SignatureValue][] = [
      ['accessKey', accessKey],
      ['amount', request.amount],
      ['extraData', request.extraData],
      ['ipnUrl', request.ipnUrl],
      ['orderId', request.orderId],
      ['orderInfo', request.orderInfo],
    ];

    if (request.requestType === 'subscription') {
      entries.push(['partnerClientId', request.partnerClientId]);
    }

    entries.push(
      ['partnerCode', request.partnerCode],
      ['redirectUrl', request.redirectUrl],
      ['requestId', request.requestId],
      ['requestType', request.requestType],
    );

    return this.sign(secretKey, this.serialize(entries));
  }

  signPaymentResult(
    accessKey: string,
    secretKey: string,
    result: MomoPaymentResult,
  ): string {
    return this.sign(
      secretKey,
      this.serialize([
        ['accessKey', accessKey],
        ['amount', result.amount],
        ['callbackToken', result.callbackToken ?? ''],
        ['extraData', result.extraData ?? ''],
        ['message', result.message],
        ['orderId', result.orderId],
        ['orderInfo', result.orderInfo ?? ''],
        ['orderType', result.orderType ?? ''],
        ['partnerClientId', result.partnerClientId ?? ''],
        ['partnerCode', result.partnerCode],
        ['payType', result.payType ?? ''],
        ['requestId', result.requestId],
        ['responseTime', result.responseTime],
        ['resultCode', result.resultCode],
        ['transId', result.transId ?? ''],
      ]),
    );
  }

  verifyPaymentResult(
    accessKey: string,
    secretKey: string,
    result: MomoPaymentResult,
  ): boolean {
    const expected = this.signPaymentResult(accessKey, secretKey, result);
    return this.safeEquals(expected, result.signature);
  }

  private serialize(entries: [string, SignatureValue][]): string {
    return entries
      .map(
        ([key, value]) =>
          `${key}=${value === undefined || value === null ? '' : String(value)}`,
      )
      .join('&');
  }

  private sign(secretKey: string, rawSignature: string): string {
    return createHmac('sha256', secretKey).update(rawSignature).digest('hex');
  }

  private safeEquals(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
