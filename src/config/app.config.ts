// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  // Payment settings
  paymentProvider: process.env.PAYMENT_PROVIDER || 'paystack',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY,

  // Tracking settings
  trackingInterval: parseInt(process.env.TRACKING_INTERVAL, 10) || 10000,

  // Security settings
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Notification settings
  smsEnabled: process.env.SMS_ENABLED === 'true',
  emailEnabled: process.env.EMAIL_ENABLED === 'true',
  pushNotificationsEnabled: process.env.PUSH_NOTIFICATIONS_ENABLED === 'true',
}));
