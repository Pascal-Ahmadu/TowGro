import { 
  Injectable,
  forwardRef, 
  InternalServerErrorException, 
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  ForbiddenException
} from '@nestjs/common';
import * as crypto from 'crypto';
import { 
  CreatePaymentDto, 
  VerifyPaymentDto, 
  RefundPaymentDto,
  PaymentResponseDto,
  WebhookPayloadDto
} from './dto/payment.dto';

import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { PAYSTACK_CLIENT } from './payment.constants';
import * as bluebird from 'bluebird';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { PaymentMethod } from './entities/payment-method.entity';

interface PaystackTransaction {
  authorization_url: string;
  reference: string;
  access_code: string;
  status: string;
  gateway_response: string;
  amount: number;
  paid_at: string;
  customer: {
    email: string;
    first_name: string;
    last_name: string;
  };
  [key: string]: any;
}

interface PaystackRefund {
  id: number;
  amount: number;
  status: string;
  created_at: string;
  [key: string]: any;
}

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface PaystackClient {
  transaction: {
    initialize: (data: any) => Promise<any>;
    verify: (reference: string) => Promise<any>;
  };
  refund: {
    create: (data: any) => Promise<any>;
  };
}

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Service responsible for handling payment processing operations
 * through the Paystack payment gateway with enhanced security
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly currencyDivisors: Record<string, number> = {
    NGN: 100, // Kobo to Naira
    USD: 100, // Cents to Dollar
    GHS: 100, // Pesewas to Cedi
    ZAR: 100, // Cents to Rand
    // Add other currencies as needed
  };
  
  // Cache of valid Paystack IPs with 1-day TTL
  private paystackIpCache: { ips: string[], expiresAt: Date } | null = null;

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    
    @Inject(PAYSTACK_CLIENT)
    private readonly paystackClient: any,
    
    private readonly configService: ConfigService,
    
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService, // Add missing comma here
    
    @InjectRepository(PaymentMethod) // Add this decorator
    private paymentMethodRepository: Repository<PaymentMethod>,
  ) {
    console.log('PaymentService dependencies verified:');
    console.log('Paystack Client:', this.paystackClient ? '✅ Available' : '❌ Missing');
  }

  /**
   * Initialize a new payment transaction via Paystack with additional security measures
   * @param dto Payment initialization data
   * @param requestContext Context information for security tracking
   * @returns Payment authorization URL and reference
   */
  async initializePayment(
    dto: CreatePaymentDto, 
    requestContext?: RequestContext
  ): Promise<PaymentResponseDto<any>> {
    try {
      this.logger.log(`Initializing payment for reference: ${dto.reference}`);
      
      // Create sanitized metadata to prevent injection attacks
      const safeMetadata = dto.metadata ? this.sanitizeMetadata(dto.metadata) : undefined;
      
      // Add request context for security tracking if provided
      if (requestContext) {
        const contextMetadata = {
          _requestInfo: {
            ipAddress: requestContext.ipAddress,
            timestamp: new Date().toISOString(),
            // Don't store full user agent, just extract browser/device info
            client: this.extractClientInfo(requestContext.userAgent || '')
          }
        };
        
        if (safeMetadata) {
          dto.metadata = { ...safeMetadata, ...contextMetadata };
        } else {
          dto.metadata = contextMetadata;
        }
      }
      
      // Add anti-fraud measures
      const response = await this.paystackClient.transaction.initialize({
        email: dto.customerEmail,
        amount: dto.amount,
        reference: dto.reference,
        currency: dto.currency,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : undefined,
        // Add additional security parameters as supported by Paystack
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      });
      
      if (!response.data || !response.status) {
        this.logger.warn(`Payment initialization failed with status: ${response.status}`);
        throw new BadRequestException('Payment initialization failed');
      }

      // Add database record with security context
      const transaction = this.transactionRepository.create({
        reference: dto.reference,
        customerEmail: dto.customerEmail,
        amount: dto.amount,
        currency: dto.currency,
        status: 'pending',
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : undefined, // Add JSON.stringify
        ipAddress: requestContext?.ipAddress,
        userAgent: requestContext?.userAgent?.substring(0, 255) // Limit length to prevent DB issues
      });
      await this.transactionRepository.save(transaction);

      this.logger.log(`Successfully initialized payment for reference: ${dto.reference}`);
      
      // Return only necessary info
      return {
        success: true,
        message: 'Payment initialized successfully',
        data: {
          authorizationUrl: response.data.authorization_url,
          reference: response.data.reference,
          accessCode: response.data.access_code,
        }
      };
    } catch (error) {
      return this.handlePaymentError(error, `Failed to initialize payment for reference: ${dto.reference}`);
    }
  }

  /**
   * Find transaction by reference, used for reference validation
   * @param reference Payment reference
   * @returns Transaction entity or null
   */
  async findTransactionByReference(reference: string): Promise<Transaction | null> {
    try {
      return await this.transactionRepository.findOne({ where: { reference } });
    } catch (error) {
      this.logger.error(`Error finding transaction ${reference}: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get payment details by reference without verifying
   * @param reference Payment reference
   * @returns Transaction details
   */
  async getPaymentDetails(reference: string): Promise<PaymentResponseDto<any>> {
    try {
      // First check local database
      const transaction = await this.transactionRepository.findOne({ where: { reference } });
      if (!transaction) {
        throw new NotFoundException(`Transaction with reference ${reference} not found`);
      }
      
      // If transaction exists but not yet verified/completed, verify with Paystack
      if (transaction.status === 'pending') {
        const verifyDto = new VerifyPaymentDto();
        verifyDto.reference = reference;
        return this.verifyPayment(verifyDto);
      }
      
      // Return transaction data from database
      const divisor = this.getCurrencyDivisor(transaction.currency);
      
      return {
        success: true,
        message: 'Payment details retrieved successfully',
        data: {
          reference: transaction.reference,
          status: transaction.status,
          amount: transaction.amount / divisor, // Convert from minor to major currency unit
          currency: transaction.currency,
          customerEmail: transaction.customerEmail,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
        }
      };
    } catch (error) {
      return this.handlePaymentError(error, `Failed to get payment details for reference: ${reference}`);
    }
  }

  /**
   * Verify the status of a payment transaction
   * @param dto Payment verification data
   * @returns Transaction details and status
   */
  async verifyPayment(dto: VerifyPaymentDto): Promise<PaymentResponseDto<any>> {
    try {
      this.logger.log(`Verifying payment for reference: ${dto.reference}`);
      
      // Implement retry mechanism for network resilience
      const response = await this.retryOperation<PaystackResponse<PaystackTransaction>>(
        () => this.paystackClient.transaction.verify(dto.reference),
        3, // Retry 3 times
        1000 // Initial delay of 1 second, will be doubled each retry
      );

      if (!response.data) {
        this.logger.warn(`Payment verification failed for reference: ${dto.reference}`);
        throw new NotFoundException(`Transaction with reference ${dto.reference} not found`);
      }

      const { status, gateway_response, amount, paid_at, customer, currency = 'NGN' } = response.data;
      const divisor = this.getCurrencyDivisor(currency);
      
      // Update transaction in database
      await this.transactionRepository.update(
        { reference: dto.reference },
        { 
          status: status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'pending',
          metadata: JSON.stringify(response.data)  // Add JSON.stringify
        }
      );
      
      this.logger.log(`Payment verification completed for reference: ${dto.reference} with status: ${status}`);
      
      // Return sanitized response
      return {
        success: true,
        message: 'Payment verification successful',
        data: {
          reference: dto.reference,
          status,
          message: gateway_response,
          amount: amount / divisor, // Convert from minor to major currency unit
          currency,
          paidAt: paid_at,
          customer: customer ? {
            email: customer.email,
            name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
          } : null,
          // Only include essential info from raw response
          paymentDetails: {
            processor: 'paystack',
            channel: response.data.channel,
            authorizationCode: response.data.authorization?.authorization_code,
            cardType: response.data.authorization?.card_type,
            bank: response.data.authorization?.bank,
            last4: response.data.authorization?.last4,
            expMonth: response.data.authorization?.exp_month,
            expYear: response.data.authorization?.exp_year,
          }
        }
      };
    } catch (error) {
      return this.handlePaymentError(error, `Failed to verify payment for reference: ${dto.reference}`);
    }
  }

  /**
   * Process a refund for a completed payment
   * @param dto Refund request data
   * @returns Refund details and status
   */
  async refundPayment(dto: RefundPaymentDto): Promise<PaymentResponseDto<any>> {
    try {
      this.logger.log(`Processing refund for reference: ${dto.reference}`);
      
      // First verify the transaction exists and is successful
      const verifyResult = await this.verifyPayment({ reference: dto.reference });
      if (!verifyResult.success || verifyResult.data?.status !== 'success') {
        throw new BadRequestException(`Cannot refund transaction that is not successful. Current status: ${verifyResult.data?.status || 'unknown'}`);
      }
      
      // Implement retry mechanism for network resilience
      const response = await this.retryOperation<PaystackResponse<PaystackRefund>>(
        () => this.paystackClient.refund.create({
          transaction: dto.reference,
          amount: dto.amount,
          ...(dto.reason && { reason: dto.reason })
        }),
        2, // Retry twice
        1000 // Initial delay of 1 second
      );

      if (!response.data || !response.status) {
        this.logger.warn(`Refund failed for reference: ${dto.reference}`);
        throw new BadRequestException('Refund processing failed');
      }

      // Get currency from verification response
      const currency = verifyResult.data?.currency || 'NGN';
      const divisor = this.getCurrencyDivisor(currency);

      // Update transaction status in database - Fixed here
      const currentDate = new Date().toISOString();
      await this.transactionRepository.update(
        { reference: dto.reference },
        { 
          status: 'refunded',
          metadata: { // Store as a normal object
            ...(verifyResult.data?.paymentDetails || {}),
            refund: response.data,
            refundedAt: currentDate,
            refundReason: dto.reason
          }
        }
      );

      this.logger.log(`Successfully processed refund for reference: ${dto.reference}`);
      
      return {
        success: true,
        message: 'Refund processed successfully',
        data: {
          reference: dto.reference,
          refundId: response.data.id,
          amount: response.data.amount / divisor,
          currency,
          status: response.data.status,
          createdAt: response.data.created_at,
        }
      };
    } catch (error) {
      return this.handlePaymentError(error, `Failed to process refund for reference: ${dto.reference}`);
    }
  }

  /**
   * Check if an IP address is a valid Paystack webhook source
   * @param ipAddress IP address to validate
   * @returns Boolean indicating if IP is valid
   */
  async isValidPaystackIp(ipAddress: string): Promise<boolean> {
    try {
      // For development and testing, allow all IPs if explicitly configured
      if (this.configService.get<string>('NODE_ENV') === 'development' && 
          this.configService.get<boolean>('ALLOW_ALL_IPS_FOR_WEBHOOKS')) {
        return true;
      }
      
      // Check cache first
      if (this.paystackIpCache && new Date() < this.paystackIpCache.expiresAt) {
        return this.paystackIpCache.ips.includes(ipAddress);
      }
      
      // For production, hardcode known Paystack IPs for fallback
      // These should be updated regularly
      const knownPaystackIps = [
        '52.31.139.75',
        '52.49.173.169',
        '52.214.14.220'
        // Add other Paystack IPs
      ];
      
      // In a real implementation, you would fetch these from Paystack's API
      // For this example, we'll use the hardcoded list
      this.paystackIpCache = {
        ips: knownPaystackIps,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };
      
      return knownPaystackIps.includes(ipAddress);
    } catch (error) {
      this.logger.error(`Error validating Paystack IP: ${error.message}`, error.stack);
      // Fail closed (deny) for security
      return false;
    }
  }

  /**
   * Verify webhook signature from Paystack
   * @param payload The webhook payload
   * @param signature The signature from x-paystack-signature header
   * @returns Boolean indicating if signature is valid
   */
  verifyWebhookSignature(payload: WebhookPayloadDto, signature: string): boolean {
    try {
      const secret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
      if (!secret) {
        this.logger.error('Missing PAYSTACK_SECRET_KEY in environment variables');
        return false;
      }

      // Convert payload to string if it's not already
      const payloadString = typeof payload === 'string' 
        ? payload 
        : JSON.stringify(payload);

      const hash = crypto
        .createHmac('sha512', secret)
        .update(payloadString)
        .digest('hex');
      
      // Use timing-safe comparison to prevent timing attacks
      return this.timingSafeEqual(hash, signature);
    } catch (error) {
      this.logger.error(`Error verifying webhook signature: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Process webhook events from Paystack
   * @param payload The webhook payload
   */
  async processWebhookEvent(payload: WebhookPayloadDto): Promise<void> {
    try {
      const event = payload.event;
      const data = payload.data;
      
      this.logger.log(`Processing webhook event: ${event} for reference: ${data?.reference || 'N/A'}`);
    
      // Use a queue or event system for production workloads
      // For this example, we'll process directly
      switch (event) {
        case 'charge.success': {
          const currentDate = new Date().toISOString();
          await this.transactionRepository.update(
            { reference: data.reference },
            { 
              status: 'success',
              metadata: JSON.stringify({ // Wrap in JSON.stringify
                ...data,
                webhookProcessedAt: currentDate,
                event: event
              })
            }
          );
          break;
        }
          
        case 'charge.failed': {
          const currentDate = new Date().toISOString();
          await this.transactionRepository.update(
            { reference: data.reference },
            { 
              status: 'failed',
              metadata: JSON.stringify({ // Wrap in JSON.stringify
                ...data,
                webhookProcessedAt: currentDate,
                event: event
              })
            }
          );
          break;
        }
          
        case 'refund.processed': {
          const currentDate = new Date().toISOString();
          await this.transactionRepository.update(
            { reference: data.reference },
            { 
              status: 'refunded',
              metadata: JSON.stringify({ // Wrap in JSON.stringify
                ...data,
                webhookProcessedAt: currentDate,
                event: event
              })
            }
          );
          break;
        }
        
        default: {
          this.logger.warn(`Unhandled event type: ${event}`);
          // Store unprocessed events
          const currentDate = new Date().toISOString();
          await this.transactionRepository.update(
            { reference: data.reference },
            { 
              metadata: JSON.stringify({ // Wrap in JSON.stringify
                ...data,
                webhookProcessedAt: currentDate,
                event: event,
                unprocessed: true
              })
            }
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error processing webhook event: ${error.message}`, error.stack);
      // For webhooks, we don't rethrow to acknowledge receipt to Paystack
      // Consider using a retry mechanism or dead letter queue in production
    }
  }

  /**
   * Handle payment-related errors with appropriate logging and exception mapping
   * @param error The caught exception
   * @param logMessage Message to log with the error
   * @returns PaymentResponseDto with error information
   */
  private handlePaymentError(error: any, logMessage: string): PaymentResponseDto {
    this.logger.error(`${logMessage}: ${error.message || 'Unknown error'}`, error.stack);
    
    // Map Paystack errors to appropriate HTTP exceptions
    if (error.response?.data?.message) {
      const paystackError = error.response.data;
      
      if (paystackError.status === false) {
        return {
          success: false,
          message: 'Payment processing failed',
          error: paystackError.message
        };
      }
    }
    
    if (error instanceof BadRequestException || 
        error instanceof NotFoundException) {
      return {
        success: false,
        message: 'Request error',
        error: error.message
      };
    }
    
    // Generic error for all other cases
    return {
      success: false,
      message: 'Payment processing error',
      error: 'An unexpected error occurred while processing your payment request.'
    };
  }

  /**
   * Get the divisor for converting between minor and major currency units
   * @param currency Currency code
   * @returns Divisor value
   */
  private getCurrencyDivisor(currency: string): number {
    return this.currencyDivisors[currency] || 100; // Default to 100 if currency not found
  }

  /**
   * Implement timing-safe string comparison to prevent timing attacks
   * @param a First string
   * @param b Second string
   * @returns Boolean indicating if strings are equal
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    // In Node.js >=6.6.0, use:
    if (crypto.timingSafeEqual) {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      return crypto.timingSafeEqual(bufA, bufB);
    }
    
    // Fallback implementation
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Sanitize metadata to prevent XSS and injection attacks
   * @param metadata Raw metadata object
   * @returns Sanitized metadata
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    // Deep clone to avoid modifying the original
    const sanitized = JSON.parse(JSON.stringify(metadata));
    
    // Helper function to sanitize strings recursively
    const sanitizeObj = (obj: any): any => {
      if (obj === null || obj === undefined) {
        return obj;
      }
      
      if (typeof obj === 'string') {
        // Remove potential XSS vectors
        return obj.replace(/<(script|iframe|object|embed|form)/gi, '&lt;$1')
                 .replace(/on\w+=/gi, 'data-removed=')
                 .replace(/javascript:/gi, 'removed:');
      }
      
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObj(item));
      }
      
      if (typeof obj === 'object') {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
          // Skip keys that look suspicious
          if (/(password|token|secret|key)$/i.test(key)) {
            continue;
          }
          result[key] = sanitizeObj(value);
        }
        return result;
      }
      
      return obj;
    };
    
    return sanitizeObj(sanitized);
  }

  /**
   * Extract client info from user agent string
   * @param userAgent User agent string
   * @returns Simplified client info
   */
  private extractClientInfo(userAgent: string): string {
    // Simple extraction of browser and OS
    // For production, consider using a proper UA parser library
    let client = 'Unknown';
    
    if (userAgent.includes('Mozilla')) {
      if (userAgent.includes('Chrome')) {
        client = 'Chrome';
      } else if (userAgent.includes('Safari')) {
        client = 'Safari';
      } else if (userAgent.includes('Firefox')) {
        client = 'Firefox';
      } else if (userAgent.includes('Edge')) {
        client = 'Edge';
      } else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
        client = 'Internet Explorer';
      }
    } else if (userAgent.includes('PostmanRuntime')) {
      client = 'Postman';
    } else if (userAgent.includes('curl')) {
      client = 'Curl';
    }
    
    if (userAgent.includes('Windows')) {
      client += ' / Windows';
    } else if (userAgent.includes('Macintosh')) {
      client += ' / Mac';
    } else if (userAgent.includes('Linux')) {
      client += ' / Linux';
    } else if (userAgent.includes('Android')) {
      client += ' / Android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      client += ' / iOS';
    }
    
    return client;
  }

  /**
   * Utility function to retry operations with exponential backoff
   * @param operation Function to retry
   * @param maxRetries Maximum number of retries
   * @param initialDelay Initial delay in milliseconds
   * @returns Promise resolving to operation result
   */
  private async retryOperation<T>(
    operation: () => Promise<T>, 
    maxRetries: number, 
    initialDelay: number
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry for certain error types
        if (error instanceof BadRequestException || 
            error instanceof ForbiddenException) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
          this.logger.warn(`Operation failed, retrying in ${delay}ms (${attempt + 1}/${maxRetries})`, error.stack);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}