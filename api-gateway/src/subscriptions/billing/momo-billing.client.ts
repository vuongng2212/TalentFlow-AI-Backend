import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { MomoSignatureService } from './momo-signature.service';
import type {
  MomoCheckoutResult,
  MomoCreateCheckoutInput,
  MomoCreateSubscriptionRequest,
  MomoCreateSubscriptionResponse,
  MomoPreparedCheckout,
} from './momo.types';

@Injectable()
export class MomoBillingClient {
  constructor(
    private readonly configService: ConfigService,
    private readonly signatureService: MomoSignatureService,
  ) {}

  prepareCheckout(input: MomoCreateCheckoutInput): MomoPreparedCheckout {
    const providerRequestId = this.createProviderId('req');
    const providerOrderId = this.createProviderId(`tf-${input.planCode}`);
    const requestType = this.configService.get<
      'captureWallet' | 'subscription'
    >('MOMO_REQUEST_TYPE', 'captureWallet');
    const baseRequest: Omit<MomoCreateSubscriptionRequest, 'signature'> = {
      partnerCode: this.getConfig('MOMO_PARTNER_CODE'),
      requestType,
      ipnUrl: this.getConfig('MOMO_IPN_URL'),
      redirectUrl: this.getConfig('MOMO_REDIRECT_URL'),
      orderId: providerOrderId,
      amount: input.amount,
      lang: this.configService.get<'vi' | 'en'>('MOMO_LANGUAGE', 'en'),
      orderInfo: `TalentFlow ${input.planName} subscription`,
      requestId: providerRequestId,
      extraData: Buffer.from(
        JSON.stringify({
          userId: input.userId,
          planCode: input.planCode,
          currency: input.currency,
        }),
      ).toString('base64'),
    };

    if (requestType === 'subscription') {
      baseRequest.partnerClientId = input.userId;
      baseRequest.subscriptionInfo = {
        partnerSubsId: providerOrderId,
        name: `TalentFlow ${input.planName}`,
        subsOwner: input.userId,
        type: 'VARIABLE',
        recurringAmount: input.amount,
        nextPaymentDate: this.formatDate(this.addMonths(new Date(), 1)),
        expiryDate: this.formatDate(this.addMonths(new Date(), 12)),
        frequency: 'MONTHLY',
      };
    }

    return {
      providerRequestId,
      providerOrderId,
      request: {
        ...baseRequest,
        signature: this.signatureService.signCreateSubscription(
          this.getConfig('MOMO_ACCESS_KEY'),
          this.getConfig('MOMO_SECRET_KEY'),
          baseRequest,
        ),
      },
    };
  }

  async createCheckout(
    input: MomoCreateCheckoutInput,
  ): Promise<MomoCheckoutResult> {
    const prepared = this.prepareCheckout(input);
    return this.submitPreparedCheckout(prepared);
  }

  async submitPreparedCheckout(
    prepared: MomoPreparedCheckout,
  ): Promise<MomoCheckoutResult> {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return {
        ...prepared,
        response: {
          partnerCode: prepared.request.partnerCode,
          requestId: prepared.providerRequestId,
          orderId: prepared.providerOrderId,
          amount: prepared.request.amount,
          resultCode: 0,
          message: 'Successful.',
          responseTime: Date.now(),
          payUrl: `https://test-payment.momo.vn/v2/gateway/pay?t=${prepared.providerOrderId}`,
          deeplink: `momo://?action=subscription&sid=${prepared.providerOrderId}`,
          qrCodeUrl: `https://test-payment.momo.vn/v2/gateway/app?t=${prepared.providerOrderId}`,
          partnerClientId: prepared.request.partnerClientId,
        },
        checkoutUrl: `https://test-payment.momo.vn/v2/gateway/pay?t=${prepared.providerOrderId}`,
        deeplink: `momo://?action=subscription&sid=${prepared.providerOrderId}`,
        qrCodeUrl: `https://test-payment.momo.vn/v2/gateway/app?t=${prepared.providerOrderId}`,
      };
    }

    const endpoint = new URL(
      '/v2/gateway/api/create',
      this.getConfig('MOMO_ENDPOINT_BASE_URL'),
    );

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(prepared.request),
      });
    } catch (error) {
      throw new BadGatewayException(
        `MoMo checkout request failed: ${this.getErrorMessage(error)}`,
      );
    }

    const responseBody =
      (await response.json()) as MomoCreateSubscriptionResponse;

    if (!response.ok) {
      throw new BadGatewayException(
        `MoMo checkout returned HTTP ${response.status}: [${responseBody.resultCode}] ${responseBody.message}`,
      );
    }

    return {
      ...prepared,
      response: responseBody,
      checkoutUrl: responseBody.payUrl ?? null,
      deeplink: responseBody.deeplink ?? null,
      qrCodeUrl: responseBody.qrCodeUrl ?? null,
    };
  }

  private createProviderId(prefix: string): string {
    return `${prefix}-${randomUUID()}`.slice(0, 50);
  }

  private getConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new BadGatewayException(`Missing MoMo configuration: ${key}`);
    }

    return value;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
