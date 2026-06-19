import {
  BillingPeriod,
  SubscriptionPlanCode,
  SubscriptionPlanScope,
} from '@prisma/client';

export const DEFAULT_BUSINESS_WORKSPACE_ID = 'mock-business-workspace';
export const SUBSCRIPTION_CURRENCY = 'VND';
export const SUBSCRIPTION_PERIOD_MONTHS = 1;

export const SUBSCRIPTION_PLAN_CATALOG = {
  [SubscriptionPlanCode.FREE]: {
    name: 'Free',
    scope: SubscriptionPlanScope.PERSONAL,
    billingPeriod: BillingPeriod.NONE,
    dailyAiRequestLimit: 5,
    trialAiRequestLimit: 15,
    isPaid: false,
    priceAmount: 0,
    currency: SUBSCRIPTION_CURRENCY,
    checkoutEligible: false,
    canScoreCv: true,
    canAnalyzeCvFit: false,
  },
  [SubscriptionPlanCode.PLUS]: {
    name: 'Plus',
    scope: SubscriptionPlanScope.PERSONAL,
    billingPeriod: BillingPeriod.MONTHLY,
    dailyAiRequestLimit: 20,
    trialAiRequestLimit: null,
    isPaid: true,
    priceAmount: 99000,
    currency: SUBSCRIPTION_CURRENCY,
    checkoutEligible: true,
    canScoreCv: true,
    canAnalyzeCvFit: true,
  },
  [SubscriptionPlanCode.BUSINESS]: {
    name: 'Business',
    scope: SubscriptionPlanScope.WORKSPACE,
    billingPeriod: BillingPeriod.MONTHLY,
    dailyAiRequestLimit: 500,
    trialAiRequestLimit: null,
    isPaid: true,
    priceAmount: 499000,
    currency: SUBSCRIPTION_CURRENCY,
    checkoutEligible: true,
    canScoreCv: true,
    canAnalyzeCvFit: true,
  },
} as const;

export const PLAN_ORDER = [
  SubscriptionPlanCode.FREE,
  SubscriptionPlanCode.PLUS,
  SubscriptionPlanCode.BUSINESS,
] as const;
