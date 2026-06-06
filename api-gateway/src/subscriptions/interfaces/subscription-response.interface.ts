import { SubscriptionStatus } from '@prisma/client';
import type {
  EntitlementActionRequest,
  EntitlementContextType,
} from './subscription-policy.interface';

export interface PlanResponse {
  code: string;
  name: string;
  scope: string;
  billingPeriod: string;
  dailyAiRequestLimit: number;
  trialAiRequestLimit: number | null;
  canScoreCv: boolean;
  canAnalyzeCvFit: boolean;
  canActivateWorkspace: boolean;
}

export interface PersonalSubscriptionStatusResponse {
  effectivePlan: PlanResponse;
  status: SubscriptionStatus;
  periodEnd: Date | null;
  remainingDailyQuota: number;
  remainingTrialQuota: number | null;
}

export interface WorkspaceSubscriptionStatusResponse {
  workspaceId: string;
  isBusinessActive: boolean;
  purchaserId: string | null;
  periodEnd: Date | null;
  remainingDailyQuota: number;
}

export interface EntitlementDecisionResponse {
  allowed: boolean;
  contextType: EntitlementContextType;
  resolvedPlan: 'Free' | 'Plus' | 'Business';
  action: EntitlementActionRequest;
  remainingDailyQuota: number;
  remainingTrialQuota: number | null;
  reason?: string;
}
