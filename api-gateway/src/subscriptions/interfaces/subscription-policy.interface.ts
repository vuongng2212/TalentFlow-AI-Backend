import {
  AiUsageAction,
  BillingPeriod,
  SubscriptionPlanCode,
  SubscriptionPlanScope,
} from '@prisma/client';

export const SUBSCRIPTION_POLICY = {
  [SubscriptionPlanCode.FREE]: {
    name: 'Free',
    scope: SubscriptionPlanScope.PERSONAL,
    billingPeriod: BillingPeriod.NONE,
    dailyAiRequestLimit: 5,
    trialAiRequestLimit: 15,
    canScoreCv: true,
    canAnalyzeCvFit: false,
    canActivateWorkspace: false,
  },
  [SubscriptionPlanCode.PLUS]: {
    name: 'Plus',
    scope: SubscriptionPlanScope.PERSONAL,
    billingPeriod: BillingPeriod.MONTHLY,
    dailyAiRequestLimit: 20,
    trialAiRequestLimit: null,
    canScoreCv: true,
    canAnalyzeCvFit: true,
    canActivateWorkspace: false,
  },
  [SubscriptionPlanCode.BUSINESS]: {
    name: 'Business',
    scope: SubscriptionPlanScope.WORKSPACE,
    billingPeriod: BillingPeriod.MONTHLY,
    dailyAiRequestLimit: 500,
    trialAiRequestLimit: null,
    canScoreCv: true,
    canAnalyzeCvFit: true,
    canActivateWorkspace: true,
  },
} as const;

export const PLAN_ORDER = [
  SubscriptionPlanCode.FREE,
  SubscriptionPlanCode.PLUS,
  SubscriptionPlanCode.BUSINESS,
] as const;

export const AI_ACTION_BY_REQUEST = {
  cv_score: AiUsageAction.CV_SCORE,
  cv_fit_analysis: AiUsageAction.CV_FIT_ANALYSIS,
} as const;

export type EntitlementContextType = 'personal' | 'workspace';
export type EntitlementActionRequest = keyof typeof AI_ACTION_BY_REQUEST;
