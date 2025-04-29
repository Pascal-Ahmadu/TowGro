// src/payment/dto/payment.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  IsObject,
  ValidateNested,
  IsEnum,
  Max,
  IsUUID,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base payment DTO with common properties and validation
 */
export abstract class BasePaymentDto {
  /**
   * Unique reference identifier for the transaction
   * @example "ORD_12345" or "DSP_67890"
   */
  @ApiProperty({
    description: 'Unique reference identifier for the transaction',
    example: 'ORD_12345',
  })
  @IsNotEmpty({ message: 'Reference is required' })
  @IsString({ message: 'Reference must be a string' })
  @Length(3, 100, { message: 'Reference must be between 3 and 100 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Reference must contain only alphanumeric characters, underscores, and hyphens',
  })
  @Transform(({ value }) => value?.trim())
  reference: string;
}

/**
 * Data required to initialize a Paystack transaction.
 * Contains all necessary fields with proper validation.
 */
export class CreatePaymentDto extends BasePaymentDto {
  /**
   * Customer's email address – Required by Paystack for payment receipts
   * @example "customer@example.com"
   */
  @ApiProperty({
    description: 'Customer email address for payment receipts',
    example: 'customer@example.com',
  })
  @IsNotEmpty({ message: 'Customer email is required' })
  @IsEmail({}, { message: 'A valid email address is required' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  customerEmail: string;

  /**
   * Amount to charge in the smallest currency unit (e.g., kobo for NGN)
   * Must be a positive number
   * @example 10000 (representing ₦100.00 in kobo)
   */
  @ApiProperty({
    description: 'Amount to charge in the smallest currency unit',
    example: 10000,
    minimum: 1,
    maximum: 1000000000,
  })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @IsPositive({ message: 'Amount must be positive' })
  @Max(1000000000, { message: 'Amount exceeds maximum allowed value' })
  @Transform(({ value }) => Number(value))
  amount: number;

  /**
   * ISO currency code (e.g., 'NGN')
   * @example "NGN"
   */
  @ApiProperty({
    description: 'ISO currency code',
    example: 'NGN',
  })
  @IsNotEmpty({ message: 'Currency is required' })
  @IsString({ message: 'Currency must be a string' })
  @Length(3, 3, { message: 'Currency must be a 3-character ISO code' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency must be a valid 3-letter ISO currency code (uppercase)',
  })
  @Transform(({ value }) => value?.toUpperCase())
  currency: string;

  /**
   * Optional metadata for tracking purposes
   * @example { "orderType": "delivery", "products": ["item1", "item2"] }
   */
  @ApiPropertyOptional({
    description: 'Optional metadata for tracking purposes',
    example: { orderType: 'delivery', products: ['item1', 'item2'] },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata must be an object' })
  @Transform(({ value }) => {
    // Remove potentially harmful content from metadata
    if (typeof value === 'object' && value !== null) {
      const sanitized = { ...value };
      // Remove script tags, iframes, and other potentially harmful content
      Object.keys(sanitized).forEach((key) => {
        if (typeof sanitized[key] === 'string') {
          // Replace anything that looks like a script or HTML
          sanitized[key] = sanitized[key]
            .replace(/<script.*?>.*?<\/script>/gi, '')
            .replace(/<.*?>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '');
        }
      });
      return sanitized;
    }
    return value;
  })
  metadata?: Record<string, any>;
}

/**
 * Data required to verify or finalize a payment.
 * Inherits from BasePaymentDto for consistent reference validation.
 */
export class VerifyPaymentDto extends BasePaymentDto {
  // Inherits reference field with validation from BasePaymentDto
}

/**
 * Data required for processing refunds via Paystack.
 * Supports both full and partial refunds.
 */
export class RefundPaymentDto extends BasePaymentDto {
  /**
   * Amount to refund in the smallest currency unit (optional for full refunds)
   * Must be a positive number when specified
   * @example 5000 (representing a partial refund of ₦50.00 in kobo)
   */
  @ApiPropertyOptional({
    description: 'Amount to refund in the smallest currency unit',
    example: 5000,
    minimum: 1,
    maximum: 1000000000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Refund amount must be a number' })
  @IsPositive({ message: 'Refund amount must be positive' })
  @Max(1000000000, { message: 'Refund amount exceeds maximum allowed value' })
  @Transform(({ value }) => (value ? Number(value) : undefined))
  amount?: number;

  /**
   * Reason for the refund (helps with tracking and reporting)
   * @example "Customer requested cancellation"
   */
  @ApiPropertyOptional({
    description: 'Reason for the refund',
    example: 'Customer requested cancellation',
  })
  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  @Length(3, 255, { message: 'Reason must be between 3 and 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Remove potentially harmful content
      return value
        .replace(/<.*?>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .trim();
    }
    return value;
  })
  reason?: string;
}

/**
 * Response structure for payment operations
 * Generic type parameter ensures type safety for different response data structures
 */
export class PaymentResponseDto<T = any> {
  @ApiProperty({
    description: 'Operation success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Payment initialized successfully',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Response data',
  })
  data?: T;

  @ApiPropertyOptional({
    description: 'Error information if operation failed',
    example: 'Invalid payment details',
  })
  error?: string;
}

/**
 * Enum for supported Paystack webhook event types
 */
export enum PaystackEventType {
  CHARGE_SUCCESS = 'charge.success',
  CHARGE_FAILED = 'charge.failed',
  TRANSFER_SUCCESS = 'transfer.success',
  TRANSFER_FAILED = 'transfer.failed',
  REFUND_PROCESSED = 'refund.processed',
  SUBSCRIPTION_CREATED = 'subscription.create',
  SUBSCRIPTION_DISABLED = 'subscription.disable',
  INVOICE_CREATED = 'invoice.create',
  INVOICE_PAID = 'invoice.payment_failed',
}

/**
 * Customer data structure from Paystack
 */
export class WebhookCustomerDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/<.*?>/g, '') : value,
  )
  first_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/<.*?>/g, '') : value,
  )
  last_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}

/**
 * Transaction data from webhook payload
 */
export class WebhookTransactionDataDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  reference: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paid_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gateway_response?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookCustomerDto)
  customer?: WebhookCustomerDto;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;

  // Add other fields as needed
  [key: string]: any;
}

/**
 * DTO for Paystack webhook events
 * This structure follows Paystack's webhook payload format
 */
export class WebhookPayloadDto {
  /**
   * Event type from Paystack
   * @example "charge.success"
   */
  @ApiProperty({
    description: 'Event type from Paystack',
    example: 'charge.success',
    enum: PaystackEventType,
  })
  @IsNotEmpty({ message: 'Event type is required' })
  @IsString({ message: 'Event type must be a string' })
  @IsEnum(PaystackEventType, {
    message: 'Event must be a valid Paystack event type',
  })
  event: PaystackEventType | string;

  /**
   * Event payload data
   */
  @ApiProperty({
    description: 'Event payload data',
    type: WebhookTransactionDataDto,
  })
  @IsNotEmpty({ message: 'Data is required' })
  @IsObject({ message: 'Data must be an object' })
  @ValidateNested()
  @Type(() => WebhookTransactionDataDto)
  data: WebhookTransactionDataDto;
}
