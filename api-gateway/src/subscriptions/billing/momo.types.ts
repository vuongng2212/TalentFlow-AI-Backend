export interface MomoSubscriptionInfo {
  partnerSubsId: string;
  name: string;
  subsOwner: string;
  type: 'VARIABLE';
  recurringAmount: number;
  nextPaymentDate: string;
  expiryDate: string;
  frequency: 'MONTHLY';
}

export interface MomoCreateSubscriptionRequest {
  partnerCode: string;
  requestType: 'captureWallet' | 'subscription';
  ipnUrl: string;
  redirectUrl: string;
  orderId: string;
  amount: number;
  lang: 'vi' | 'en';
  orderInfo: string;
  requestId: string;
  partnerClientId?: string;
  extraData: string;
  signature: string;
  subscriptionInfo?: MomoSubscriptionInfo;
}

export interface MomoCreateSubscriptionResponse {
  partnerCode?: string;
  requestId?: string;
  orderId?: string;
  amount?: number;
  payUrl?: string;
  deeplink?: string;
  qrCodeUrl?: string;
  deeplinkMiniApp?: string;
  resultCode: number;
  message: string;
  responseTime?: number;
  partnerClientId?: string;
}

export interface MomoPaymentResult {
  partnerCode: string;
  requestId: string;
  orderId: string;
  amount: number;
  orderInfo?: string;
  orderType?: string;
  partnerClientId?: string;
  callbackToken?: string;
  transId?: string | number;
  resultCode: number;
  message: string;
  payType?: string;
  responseTime: number;
  extraData?: string;
  signature: string;
  [key: string]: unknown;
}

export interface MomoCreateCheckoutInput {
  userId: string;
  planCode: string;
  planName: string;
  amount: number;
  currency: string;
}

export interface MomoPreparedCheckout {
  providerRequestId: string;
  providerOrderId: string;
  request: MomoCreateSubscriptionRequest;
}

export interface MomoCheckoutResult extends MomoPreparedCheckout {
  response: MomoCreateSubscriptionResponse;
  checkoutUrl: string | null;
  deeplink: string | null;
  qrCodeUrl: string | null;
}
