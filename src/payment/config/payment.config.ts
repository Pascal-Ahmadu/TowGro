// src/payment/config/payment.config.ts
export const PAYMENT_CONFIG = 'PAYMENT_CONFIG';

export interface PaymentConfig {
  isGlobal?: boolean;
  paystack?: {
    secretKey?: string;
  };
}

export const defaultPaymentConfig: PaymentConfig = {
  isGlobal: false,
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
  },
};
