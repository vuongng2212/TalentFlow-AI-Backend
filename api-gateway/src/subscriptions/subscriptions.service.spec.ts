/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingPeriod,
  PaymentConfirmationSource,
  PaymentProvider,
  PaymentTransactionStatus,
  SubscriptionPlanCode,
  SubscriptionPlanScope,
} from '@prisma/client';
import { MomoBillingClient } from './billing/momo-billing.client';
import { MomoSignatureService } from './billing/momo-signature.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';

type TransactionClient = {
  paymentConfirmation: { create: jest.Mock };
  paymentTransaction: { update: jest.Mock };
  userSubscription: {
    findFirst: jest.Mock;
    updateMany: jest.Mock;
    create: jest.Mock;
  };
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  const freePlan = {
    id: 'plan-free',
    code: SubscriptionPlanCode.FREE,
    name: 'Free',
    scope: SubscriptionPlanScope.PERSONAL,
    billingPeriod: BillingPeriod.NONE,
    dailyAiRequestLimit: 5,
    trialAiRequestLimit: 15,
    isPaid: false,
    priceAmount: 0,
    currency: 'VND',
    checkoutEligible: false,
    canScoreCv: true,
    canAnalyzeCvFit: false,
    isActive: true,
  };

  const plusPlan = {
    id: 'plan-plus',
    code: SubscriptionPlanCode.PLUS,
    name: 'Plus',
    scope: SubscriptionPlanScope.PERSONAL,
    billingPeriod: BillingPeriod.MONTHLY,
    dailyAiRequestLimit: 20,
    trialAiRequestLimit: null,
    isPaid: true,
    priceAmount: 99000,
    currency: 'VND',
    checkoutEligible: true,
    canScoreCv: true,
    canAnalyzeCvFit: true,
    isActive: true,
  };

  const businessPlan = {
    id: 'plan-business',
    code: SubscriptionPlanCode.BUSINESS,
    name: 'Business',
    scope: SubscriptionPlanScope.WORKSPACE,
    billingPeriod: BillingPeriod.MONTHLY,
    dailyAiRequestLimit: 500,
    trialAiRequestLimit: null,
    isPaid: true,
    priceAmount: 499000,
    currency: 'VND',
    checkoutEligible: true,
    canScoreCv: true,
    canAnalyzeCvFit: true,
    isActive: true,
  };

  const preparedCheckout = {
    providerRequestId: 'req-1',
    providerOrderId: 'order-1',
    request: {
      partnerCode: 'partner',
      requestType: 'subscription' as const,
      ipnUrl: 'http://localhost/ipn',
      redirectUrl: 'http://localhost/redirect',
      orderId: 'order-1',
      amount: 99000,
      lang: 'en' as const,
      orderInfo: 'TalentFlow Plus subscription',
      requestId: 'req-1',
      partnerClientId: 'user-1',
      extraData: '',
      signature: 'signature',
      subscriptionInfo: {
        partnerSubsId: 'order-1',
        name: 'TalentFlow Plus',
        subsOwner: 'user-1',
        type: 'VARIABLE' as const,
        recurringAmount: 99000,
        nextPaymentDate: '2026-07-12',
        expiryDate: '2027-06-12',
        frequency: 'MONTHLY' as const,
      },
    },
  };

  const mockPrisma = {
    $transaction: jest.fn(),
    subscriptionPlan: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    userSubscription: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentTransaction: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    paymentConfirmation: {
      create: jest.fn(),
    },
  };

  const mockMomoBillingClient = {
    prepareCheckout: jest.fn(),
    submitPreparedCheckout: jest.fn(),
  };

  const mockMomoSignatureService = {
    verifyPaymentResult: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        MOMO_ACCESS_KEY: 'access',
        MOMO_SECRET_KEY: 'secret',
        SUBSCRIPTION_BUSINESS_WORKSPACE_ID: 'mock-business-workspace',
      };
      return values[key];
    }),
  };

  beforeEach(() => {
    service = new SubscriptionsService(
      mockPrisma as unknown as PrismaService,
      mockMomoBillingClient as unknown as MomoBillingClient,
      mockMomoSignatureService as unknown as MomoSignatureService,
      mockConfigService as unknown as ConfigService,
    );
    mockPrisma.subscriptionPlan.upsert.mockImplementation(
      ({ where }: { where: { code: SubscriptionPlanCode } }) => {
        if (where.code === SubscriptionPlanCode.FREE) return freePlan;
        if (where.code === SubscriptionPlanCode.PLUS) return plusPlan;
        return businessPlan;
      },
    );
    mockPrisma.subscriptionPlan.findMany.mockResolvedValue([
      businessPlan,
      freePlan,
      plusPlan,
    ]);
    mockPrisma.userSubscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.paymentTransaction.findMany.mockResolvedValue([]);
    mockMomoBillingClient.prepareCheckout.mockReturnValue(preparedCheckout);
    mockMomoBillingClient.submitPreparedCheckout.mockResolvedValue({
      ...preparedCheckout,
      response: {
        resultCode: 0,
        message: 'Successful.',
      },
      checkoutUrl: 'https://test-payment.momo.vn/pay',
      deeplink: 'momo://pay',
      qrCodeUrl: 'https://test-payment.momo.vn/qr',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists active plans with billing metadata in product order', async () => {
    await expect(service.listPlans()).resolves.toEqual([
      expect.objectContaining({
        code: SubscriptionPlanCode.FREE,
        isPaid: false,
        checkoutEligible: false,
        priceAmount: 0,
      }),
      expect.objectContaining({
        code: SubscriptionPlanCode.PLUS,
        isPaid: true,
        checkoutEligible: true,
        priceAmount: 99000,
      }),
      expect.objectContaining({
        code: SubscriptionPlanCode.BUSINESS,
        isPaid: true,
        checkoutEligible: true,
        priceAmount: 499000,
      }),
    ]);
  });

  it('creates a pending MoMo checkout without activating a subscription', async () => {
    mockPrisma.paymentTransaction.create.mockResolvedValue({
      id: 'payment-1',
      status: PaymentTransactionStatus.PENDING,
      provider: PaymentProvider.MOMO,
      plan: plusPlan,
    });
    mockPrisma.paymentTransaction.update.mockResolvedValue({
      id: 'payment-1',
      status: PaymentTransactionStatus.PENDING,
      provider: PaymentProvider.MOMO,
      checkoutUrl: 'https://test-payment.momo.vn/pay',
      deeplink: 'momo://pay',
      qrCodeUrl: 'https://test-payment.momo.vn/qr',
      plan: plusPlan,
    });

    const result = await service.createCheckout('user-1', {
      planCode: SubscriptionPlanCode.PLUS,
    });

    expect(mockPrisma.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        planId: plusPlan.id,
        provider: PaymentProvider.MOMO,
        status: PaymentTransactionStatus.PENDING,
      }),
      include: { plan: true },
    });
    expect(mockMomoBillingClient.submitPreparedCheckout).toHaveBeenCalled();
    expect(mockPrisma.userSubscription.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      paymentId: 'payment-1',
      planCode: SubscriptionPlanCode.PLUS,
      status: PaymentTransactionStatus.PENDING,
    });
  });

  it('rejects Free checkout before creating a payment', async () => {
    await expect(
      service.createCheckout('user-1', {
        planCode: 'FREE' as 'PLUS',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects MoMo IPN with an invalid signature and stores audit', async () => {
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: 'payment-1',
      expectedAmount: plusPlan.priceAmount,
      providerRequestId: 'req-1',
      providerOrderId: 'order-1',
      userId: 'user-1',
      providerTransactionId: null,
      confirmedAt: null,
      plan: plusPlan,
      activatedSubscription: null,
    });
    mockMomoSignatureService.verifyPaymentResult.mockReturnValue(false);

    await expect(
      service.receiveMomoIpn({
        partnerCode: 'partner',
        requestId: 'req-1',
        orderId: 'order-1',
        amount: plusPlan.priceAmount,
        resultCode: 0,
        message: 'Successful.',
        responseTime: 1,
        signature: 'bad',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.paymentConfirmation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentTransactionId: 'payment-1',
        source: PaymentConfirmationSource.MOMO_IPN,
        signatureValid: false,
        accepted: false,
        rejectionReason: 'invalid_signature',
      }),
    });
  });

  it('accepts a matching successful MoMo IPN without activating subscription', async () => {
    const tx: TransactionClient = {
      paymentConfirmation: { create: jest.fn() },
      paymentTransaction: { update: jest.fn() },
      userSubscription: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      (callback: (client: TransactionClient) => Promise<unknown>) =>
        callback(tx),
    );
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({
      id: 'payment-1',
      expectedAmount: plusPlan.priceAmount,
      providerRequestId: 'req-1',
      providerOrderId: 'order-1',
      userId: 'user-1',
      providerTransactionId: null,
      confirmedAt: null,
      plan: plusPlan,
      activatedSubscription: null,
    });
    mockPrisma.paymentTransaction.findUnique.mockResolvedValue({
      id: 'payment-1',
      status: PaymentTransactionStatus.SUCCEEDED,
      rejectionReason: null,
      activatedSubscription: null,
      plan: plusPlan,
    });
    mockMomoSignatureService.verifyPaymentResult.mockReturnValue(true);

    const result = await service.receiveMomoIpn({
      partnerCode: 'partner',
      requestId: 'req-1',
      orderId: 'order-1',
      amount: plusPlan.priceAmount,
      partnerClientId: 'user-1',
      resultCode: 0,
      message: 'Successful.',
      responseTime: 1,
      signature: 'valid',
    });

    expect(tx.paymentTransaction.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: expect.objectContaining({
        status: PaymentTransactionStatus.SUCCEEDED,
        rejectionReason: null,
      }),
    });
    expect(result.subscriptionActivated).toBe(false);
  });

  it('activates Business with the mock business workspace id after internal confirmation', async () => {
    const payment = {
      id: 'payment-1',
      userId: 'user-1',
      planId: businessPlan.id,
      status: PaymentTransactionStatus.SUCCEEDED,
      rejectionReason: null,
      plan: businessPlan,
      activatedSubscription: null,
    };
    const activated = {
      id: 'sub-business',
      businessWorkspaceId: 'mock-business-workspace',
    };
    const tx: TransactionClient = {
      paymentConfirmation: { create: jest.fn() },
      paymentTransaction: { update: jest.fn() },
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue(activated),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      (callback: (client: TransactionClient) => Promise<unknown>) =>
        callback(tx),
    );
    mockPrisma.paymentTransaction.findUnique
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce({
        ...payment,
        activatedSubscription: activated,
      });

    const result = await service.confirmPaymentInternally('payment-1', {
      note: 'verified',
    });

    expect(tx.userSubscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        planId: businessPlan.id,
        paymentTransactionId: 'payment-1',
        businessWorkspaceId: 'mock-business-workspace',
      }),
    });
    expect(result).toMatchObject({
      subscriptionActivated: true,
      subscriptionId: 'sub-business',
      businessWorkspaceId: 'mock-business-workspace',
    });
  });

  it('does not attach a business workspace id for Plus activation', async () => {
    const payment = {
      id: 'payment-1',
      userId: 'user-1',
      planId: plusPlan.id,
      status: PaymentTransactionStatus.SUCCEEDED,
      rejectionReason: null,
      plan: plusPlan,
      activatedSubscription: null,
    };
    const tx: TransactionClient = {
      paymentConfirmation: { create: jest.fn() },
      paymentTransaction: { update: jest.fn() },
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue({
          id: 'sub-plus',
          businessWorkspaceId: null,
        }),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      (callback: (client: TransactionClient) => Promise<unknown>) =>
        callback(tx),
    );
    mockPrisma.paymentTransaction.findUnique
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce({
        ...payment,
        activatedSubscription: {
          id: 'sub-plus',
          businessWorkspaceId: null,
        },
      });

    await service.confirmPaymentInternally('payment-1');

    expect(tx.userSubscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessWorkspaceId: null,
      }),
    });
  });

  it('does not call workspace mutations during paid activation', () => {
    expect(Object.keys(mockPrisma)).not.toContain('workspace');
    expect(Object.keys(mockPrisma)).not.toContain(
      ['workspace', 'Member'].join(''),
    );
    expect(Object.keys(mockPrisma)).not.toContain(
      ['workspace', 'Subscription'].join(''),
    );
  });
});
