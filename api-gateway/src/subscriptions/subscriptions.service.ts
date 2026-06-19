import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentConfirmationSource,
  PaymentProvider,
  PaymentTransactionStatus,
  Prisma,
  SubscriptionPlanCode,
  SubscriptionStatus,
} from '@prisma/client';
import {
  DEFAULT_BUSINESS_WORKSPACE_ID,
  PLAN_ORDER,
  SUBSCRIPTION_PERIOD_MONTHS,
  SUBSCRIPTION_PLAN_CATALOG,
} from './constants/subscription.constants';
import { MomoBillingClient } from './billing/momo-billing.client';
import { MomoSignatureService } from './billing/momo-signature.service';
import type { MomoPaymentResult } from './billing/momo.types';
import {
  CreateSubscriptionCheckoutDto,
  InternalConfirmPaymentDto,
  MomoPaymentResultDto,
} from './dto/subscription-billing.dto';
import type {
  CreateCheckoutResponse,
  PaymentConfirmationResultResponse,
  PaymentTransactionSummaryResponse,
  SubscriptionStatusResponse,
} from './interfaces/subscription-billing-response.interface';
import type { PlanResponse } from './interfaces/subscription-response.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly momoBillingClient: MomoBillingClient,
    private readonly momoSignatureService: MomoSignatureService,
    private readonly configService: ConfigService,
  ) {}

  async listPlans(): Promise<PlanResponse[]> {
    await this.ensurePlanCatalog();
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: {
        code: { in: [...PLAN_ORDER] },
        isActive: true,
      },
    });

    return plans
      .sort(
        (left, right) =>
          PLAN_ORDER.indexOf(left.code) - PLAN_ORDER.indexOf(right.code),
      )
      .map((plan) => this.mapPlan(plan));
  }

  async ensureDefaultFreeSubscription(userId: string) {
    const freePlan = await this.ensurePlan(SubscriptionPlanCode.FREE);
    const existing = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.userSubscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        periodStart: new Date(),
      },
    });
  }

  async getPersonalStatus(userId: string): Promise<SubscriptionStatusResponse> {
    const subscription = await this.resolveCurrentSubscription(userId);
    const pendingPayments = await this.prisma.paymentTransaction.findMany({
      where: {
        userId,
        status: PaymentTransactionStatus.PENDING,
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      currentPlan: this.mapPlan(subscription.plan),
      status: subscription.status,
      periodEnd: subscription.periodEnd,
      businessWorkspaceId: subscription.businessWorkspaceId,
      pendingPayments: pendingPayments.map((payment) =>
        this.mapPaymentSummary(payment),
      ),
    };
  }

  async createCheckout(
    userId: string,
    dto: CreateSubscriptionCheckoutDto,
  ): Promise<CreateCheckoutResponse> {
    const plan = await this.ensurePlan(dto.planCode);

    if (!plan.isActive || !plan.isPaid || !plan.checkoutEligible) {
      throw new BadRequestException('Plan is not eligible for checkout');
    }

    if (plan.priceAmount <= 0 || plan.currency !== 'VND') {
      throw new BadRequestException('Plan has invalid checkout pricing');
    }

    const prepared = this.momoBillingClient.prepareCheckout({
      userId,
      planCode: plan.code,
      planName: plan.name,
      amount: plan.priceAmount,
      currency: plan.currency,
    });

    const payment = await this.prisma.paymentTransaction.create({
      data: {
        userId,
        planId: plan.id,
        provider: PaymentProvider.MOMO,
        providerRequestId: prepared.providerRequestId,
        providerOrderId: prepared.providerOrderId,
        expectedAmount: plan.priceAmount,
        currency: plan.currency,
        status: PaymentTransactionStatus.PENDING,
        rawProviderRequest: this.toJson(prepared.request),
      },
      include: { plan: true },
    });

    try {
      const checkout =
        await this.momoBillingClient.submitPreparedCheckout(prepared);

      if (checkout.response.resultCode !== 0) {
        await this.prisma.paymentTransaction.update({
          where: { id: payment.id },
          data: {
            status: PaymentTransactionStatus.REJECTED,
            rejectionReason: checkout.response.message,
            rawProviderResponse: this.toJson(checkout.response),
          },
        });
        throw new BadGatewayException(checkout.response.message);
      }

      const updatedPayment = await this.prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          checkoutUrl: checkout.checkoutUrl,
          deeplink: checkout.deeplink,
          qrCodeUrl: checkout.qrCodeUrl,
          rawProviderResponse: this.toJson(checkout.response),
        },
        include: { plan: true },
      });

      return this.mapCheckoutResponse(updatedPayment);
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      await this.prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: PaymentTransactionStatus.REJECTED,
          rejectionReason: this.getErrorMessage(error),
        },
      });
      throw error;
    }
  }

  async receiveMomoIpn(
    dto: MomoPaymentResultDto,
  ): Promise<PaymentConfirmationResultResponse> {
    const payment = await this.prisma.paymentTransaction.findFirst({
      where: {
        provider: PaymentProvider.MOMO,
        providerRequestId: dto.requestId,
        providerOrderId: dto.orderId,
      },
      include: {
        plan: true,
        activatedSubscription: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment transaction not found');
    }

    const result = dto as MomoPaymentResult;
    const signatureValid = this.momoSignatureService.verifyPaymentResult(
      this.getConfig('MOMO_ACCESS_KEY'),
      this.getConfig('MOMO_SECRET_KEY'),
      result,
    );

    if (!signatureValid) {
      await this.createConfirmationAudit({
        paymentTransactionId: payment.id,
        source: PaymentConfirmationSource.MOMO_IPN,
        resultCode: dto.resultCode,
        message: dto.message,
        signatureValid: false,
        accepted: false,
        rejectionReason: 'invalid_signature',
        rawPayload: dto,
      });
      throw new BadRequestException('Invalid MoMo signature');
    }

    const mismatch = this.getMomoMismatchReason(payment, result);
    const nextStatus = this.mapMomoResultStatus(dto.resultCode);
    const accepted = mismatch === null;

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentConfirmation.create({
        data: {
          paymentTransactionId: payment.id,
          source: PaymentConfirmationSource.MOMO_IPN,
          resultCode: dto.resultCode,
          message: dto.message,
          signatureValid,
          accepted,
          rejectionReason: mismatch,
          rawPayload: this.toJson(dto),
        },
      });

      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: accepted ? nextStatus : PaymentTransactionStatus.REJECTED,
          providerTransactionId:
            dto.transId === undefined
              ? payment.providerTransactionId
              : String(dto.transId),
          rawProviderResponse: this.toJson(dto),
          rejectionReason: mismatch,
          confirmedAt: accepted ? new Date() : payment.confirmedAt,
        },
      });
    });

    if (!accepted) {
      throw new BadRequestException(mismatch);
    }

    const updated = await this.getPaymentWithActivation(payment.id);
    return this.mapConfirmationResult(updated, false, null);
  }

  async confirmPaymentInternally(
    paymentId: string,
    dto: InternalConfirmPaymentDto = {},
  ): Promise<PaymentConfirmationResultResponse> {
    const payment = await this.getPaymentWithActivation(paymentId);

    if (
      payment.status === PaymentTransactionStatus.SUCCEEDED &&
      payment.activatedSubscription
    ) {
      await this.createConfirmationAudit({
        paymentTransactionId: payment.id,
        source: PaymentConfirmationSource.INTERNAL_REPLAY,
        resultCode: 0,
        message: dto.note ?? 'Duplicate internal confirmation',
        signatureValid: true,
        accepted: true,
        rawPayload: dto,
      });
      return this.mapConfirmationResult(payment, true, null);
    }

    if (payment.status !== PaymentTransactionStatus.SUCCEEDED) {
      await this.createConfirmationAudit({
        paymentTransactionId: payment.id,
        source: PaymentConfirmationSource.INTERNAL_OPERATOR,
        resultCode: null,
        message: dto.note ?? 'Internal confirmation rejected',
        signatureValid: true,
        accepted: false,
        rejectionReason: 'payment_not_successful',
        rawPayload: dto,
      });
      throw new BadRequestException('Payment is not successful');
    }

    const subscription = await this.prisma.$transaction(async (tx) => {
      const current = await tx.userSubscription.findFirst({
        where: {
          userId: payment.userId,
          status: SubscriptionStatus.ACTIVE,
          plan: {
            code: {
              in: [SubscriptionPlanCode.PLUS, SubscriptionPlanCode.BUSINESS],
            },
          },
          periodEnd: { gt: new Date() },
        },
      });

      if (current?.paymentTransactionId === payment.id) {
        return current;
      }

      await tx.userSubscription.updateMany({
        where: {
          userId: payment.userId,
          status: SubscriptionStatus.ACTIVE,
          plan: {
            code: {
              in: [SubscriptionPlanCode.PLUS, SubscriptionPlanCode.BUSINESS],
            },
          },
        },
        data: { status: SubscriptionStatus.CANCELLED },
      });

      const now = new Date();
      const activated = await tx.userSubscription.create({
        data: {
          userId: payment.userId,
          planId: payment.planId,
          status: SubscriptionStatus.ACTIVE,
          periodStart: now,
          periodEnd: this.addMonths(now, SUBSCRIPTION_PERIOD_MONTHS),
          paymentTransactionId: payment.id,
          businessWorkspaceId:
            payment.plan.code === SubscriptionPlanCode.BUSINESS
              ? this.getBusinessWorkspaceId()
              : null,
        },
      });

      await tx.paymentConfirmation.create({
        data: {
          paymentTransactionId: payment.id,
          source: PaymentConfirmationSource.INTERNAL_OPERATOR,
          resultCode: 0,
          message: dto.note ?? 'Internal confirmation accepted',
          signatureValid: true,
          accepted: true,
          rawPayload: this.toJson(dto),
        },
      });

      return activated;
    });

    const updated = await this.getPaymentWithActivation(payment.id);
    return this.mapConfirmationResult(updated, true, subscription.id);
  }

  private async resolveCurrentSubscription(userId: string) {
    await this.expirePersonalSubscriptions(userId);
    await this.ensureDefaultFreeSubscription(userId);

    const paid = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        periodEnd: { gt: new Date() },
        plan: {
          code: {
            in: [SubscriptionPlanCode.PLUS, SubscriptionPlanCode.BUSINESS],
          },
        },
      },
      include: { plan: true },
      orderBy: { periodEnd: 'desc' },
    });

    if (paid) {
      return paid;
    }

    const free = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        plan: { code: SubscriptionPlanCode.FREE },
      },
      include: { plan: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!free) {
      throw new NotFoundException('Free subscription could not be resolved');
    }

    return free;
  }

  private async ensurePlanCatalog() {
    await Promise.all(PLAN_ORDER.map((code) => this.ensurePlan(code)));
  }

  private async ensurePlan(code: SubscriptionPlanCode) {
    const policy = SUBSCRIPTION_PLAN_CATALOG[code];

    return this.prisma.subscriptionPlan.upsert({
      where: { code },
      update: {
        name: policy.name,
        scope: policy.scope,
        billingPeriod: policy.billingPeriod,
        dailyAiRequestLimit: policy.dailyAiRequestLimit,
        trialAiRequestLimit: policy.trialAiRequestLimit,
        isPaid: policy.isPaid,
        priceAmount: policy.priceAmount,
        currency: policy.currency,
        checkoutEligible: policy.checkoutEligible,
        canScoreCv: policy.canScoreCv,
        canAnalyzeCvFit: policy.canAnalyzeCvFit,
      },
      create: {
        code,
        name: policy.name,
        scope: policy.scope,
        billingPeriod: policy.billingPeriod,
        dailyAiRequestLimit: policy.dailyAiRequestLimit,
        trialAiRequestLimit: policy.trialAiRequestLimit,
        isPaid: policy.isPaid,
        priceAmount: policy.priceAmount,
        currency: policy.currency,
        checkoutEligible: policy.checkoutEligible,
        canScoreCv: policy.canScoreCv,
        canAnalyzeCvFit: policy.canAnalyzeCvFit,
        isActive: true,
      },
    });
  }

  private async expirePersonalSubscriptions(userId: string) {
    await this.prisma.userSubscription.updateMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        periodEnd: { lt: new Date() },
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });
  }

  private async getPaymentWithActivation(paymentId: string) {
    const payment = await this.prisma.paymentTransaction.findUnique({
      where: { id: paymentId },
      include: {
        plan: true,
        activatedSubscription: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment transaction not found');
    }

    return payment;
  }

  private async createConfirmationAudit(input: {
    paymentTransactionId: string;
    source: PaymentConfirmationSource;
    resultCode?: number | null;
    message?: string | null;
    signatureValid: boolean;
    accepted: boolean;
    rejectionReason?: string | null;
    rawPayload?: unknown;
  }) {
    return this.prisma.paymentConfirmation.create({
      data: {
        paymentTransactionId: input.paymentTransactionId,
        source: input.source,
        resultCode: input.resultCode,
        message: input.message,
        signatureValid: input.signatureValid,
        accepted: input.accepted,
        rejectionReason: input.rejectionReason,
        rawPayload: this.toJson(input.rawPayload ?? {}),
      },
    });
  }

  private getMomoMismatchReason(
    payment: {
      expectedAmount: number;
      currency: string;
      providerRequestId: string;
      providerOrderId: string;
      userId: string;
    },
    result: MomoPaymentResult,
  ): string | null {
    if (result.requestId !== payment.providerRequestId)
      return 'request_id_mismatch';
    if (result.orderId !== payment.providerOrderId) return 'order_id_mismatch';
    if (Number(result.amount) !== payment.expectedAmount)
      return 'amount_mismatch';
    if (result.partnerClientId && result.partnerClientId !== payment.userId) {
      return 'user_mismatch';
    }
    return null;
  }

  private mapMomoResultStatus(resultCode: number): PaymentTransactionStatus {
    if (resultCode === 0) return PaymentTransactionStatus.SUCCEEDED;
    if (resultCode === 1006) return PaymentTransactionStatus.PENDING;
    if ([49, 1005].includes(resultCode))
      return PaymentTransactionStatus.CANCELLED;
    if ([1004, 7002].includes(resultCode))
      return PaymentTransactionStatus.EXPIRED;
    return PaymentTransactionStatus.FAILED;
  }

  private mapPlan(plan: {
    code: SubscriptionPlanCode;
    name: string;
    billingPeriod: string;
    isPaid: boolean;
    priceAmount: number;
    currency: string;
    isActive: boolean;
    checkoutEligible: boolean;
  }): PlanResponse {
    return {
      code: plan.code,
      name: plan.name,
      billingPeriod: plan.billingPeriod,
      isPaid: plan.isPaid,
      priceAmount: plan.priceAmount,
      currency: plan.currency,
      isActive: plan.isActive,
      checkoutEligible: plan.checkoutEligible,
    };
  }

  private mapPaymentSummary(input: {
    id: string;
    plan: { code: SubscriptionPlanCode };
    provider: PaymentProvider;
    status: PaymentTransactionStatus;
    expectedAmount: number;
    currency: string;
  }): PaymentTransactionSummaryResponse {
    return {
      paymentId: input.id,
      planCode: input.plan.code,
      provider: input.provider,
      status: input.status,
      expectedAmount: input.expectedAmount,
      currency: input.currency,
    };
  }

  private mapCheckoutResponse(input: {
    id: string;
    plan: { code: SubscriptionPlanCode };
    provider: PaymentProvider;
    status: PaymentTransactionStatus;
    checkoutUrl: string | null;
    deeplink: string | null;
    qrCodeUrl: string | null;
  }): CreateCheckoutResponse {
    return {
      paymentId: input.id,
      planCode: input.plan.code,
      provider: input.provider,
      status: input.status,
      checkoutUrl: input.checkoutUrl,
      deeplink: input.deeplink,
      qrCodeUrl: input.qrCodeUrl,
      expiresAt: null,
    };
  }

  private mapConfirmationResult(
    payment: {
      id: string;
      status: PaymentTransactionStatus;
      rejectionReason: string | null;
      activatedSubscription: {
        id: string;
        businessWorkspaceId: string | null;
      } | null;
    },
    subscriptionActivated: boolean,
    subscriptionId: string | null,
  ): PaymentConfirmationResultResponse {
    const activated = payment.activatedSubscription;

    return {
      paymentId: payment.id,
      accepted: payment.rejectionReason === null,
      paymentStatus: payment.status,
      subscriptionActivated,
      subscriptionId: subscriptionId ?? activated?.id ?? null,
      businessWorkspaceId: activated?.businessWorkspaceId ?? null,
      rejectionReason: payment.rejectionReason,
    };
  }

  private getConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new BadGatewayException(`Missing MoMo configuration: ${key}`);
    }

    return value;
  }

  private getBusinessWorkspaceId(): string {
    return (
      this.configService.get<string>('SUBSCRIPTION_BUSINESS_WORKSPACE_ID') ??
      DEFAULT_BUSINESS_WORKSPACE_ID
    );
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
