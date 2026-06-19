export interface PlanResponse {
  code: string;
  name: string;
  billingPeriod: string;
  isPaid: boolean;
  priceAmount: number;
  currency: string;
  isActive: boolean;
  checkoutEligible: boolean;
}
