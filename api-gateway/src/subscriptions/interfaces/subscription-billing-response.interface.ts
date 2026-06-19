import {
  PaymentProvider,
  PaymentTransactionStatus,
  SubscriptionStatus,
} from '@prisma/client';
import type { PlanResponse } from './subscription-response.interface';

export interface CreateCheckoutResponse {
  paymentId: string;
  planCode: string;
  provider: PaymentProvider;
  status: PaymentTransactionStatus;
  checkoutUrl: string | null;
  deeplink: string | null;
  qrCodeUrl: string | null;
  expiresAt: Date | null;
}

export interface PaymentTransactionSummaryResponse {
  paymentId: string;
  planCode: string;
  provider: PaymentProvider;
  status: PaymentTransactionStatus;
  expectedAmount: number;
  currency: string;
}

export interface SubscriptionStatusResponse {
  currentPlan: PlanResponse;
  status: SubscriptionStatus;
  periodEnd: Date | null;
  businessWorkspaceId: string | null;
  pendingPayments: PaymentTransactionSummaryResponse[];
}

export interface PaymentConfirmationResultResponse {
  paymentId: string;
  accepted: boolean;
  paymentStatus: PaymentTransactionStatus;
  subscriptionActivated: boolean;
  subscriptionId: string | null;
  businessWorkspaceId: string | null;
  rejectionReason: string | null;
}
