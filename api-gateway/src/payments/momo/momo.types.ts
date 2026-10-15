export interface PaymentQuote {
  code: string;
  description: string;
  amountVnd: number;
  taxVnd: number;
  totalVnd: number;
  termsVersion: string;
  quantity: 1;
}

export interface MomoCreateRequest {
  partnerCode: string;
  accessKey: string;
  requestId: string;
  amount: number;
  orderId: string;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  requestType: 'captureWallet';
  extraData: string;
  autoCapture: boolean;
  lang: 'vi';
  signature: string;
}

export interface MomoCreateResponse {
  partnerCode?: string;
  requestId?: string;
  orderId?: string;
  amount?: number;
  resultCode: number;
  message?: string;
  payUrl?: string;
  deeplink?: string;
  qrCodeUrl?: string;
}

export interface MomoQueryRequest {
  partnerCode: string;
  accessKey: string;
  requestId: string;
  orderId: string;
  lang: 'vi';
  signature: string;
}

export interface MomoIpnPayload {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: string | number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: string | number;
  extraData: string;
  signature: string;
}

export type MomoQueryResponse = MomoIpnPayload;

export class MomoProviderError extends Error {
  constructor(
    readonly safeCode:
      | 'MOMO_TIMEOUT'
      | 'MOMO_NETWORK_ERROR'
      | 'MOMO_INVALID_RESPONSE'
      | 'MOMO_PROVIDER_REJECTED',
  ) {
    super(safeCode);
  }
}

export const MOMO_PROCESSING_RESULT_CODES = new Set([10, 11, 1000, 1001]);
