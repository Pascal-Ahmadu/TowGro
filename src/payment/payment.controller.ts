// src/payment/payment.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  ClassSerializerInterceptor,
  ValidationPipe,
  Headers,
  UnauthorizedException,
  UseGuards,
  Request,
  BadRequestException,
  ConflictException,
  Ip,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiBody,
  ApiHeader,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import {
  CreatePaymentDto,
  VerifyPaymentDto,
  PaymentResponseDto,
  RefundPaymentDto,
  WebhookPayloadDto,
} from './dto/payment.dto';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Throttle } from '@nestjs/throttler';
import { ReferenceGuard } from './guards/reference.guard'; // Update import path

/**
 * Controller for handling payment-related operations
 * Implements rate limiting and request validation
 */
@ApiTags('payments')
@Controller('payments')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(ThrottlerGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Initialize a Paystack transaction.
   * Returns the initialization data with authorization URL and reference.
   */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Stricter rate limit for payment creation
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize a payment transaction' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Payment initialized successfully',
    type: PaymentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid payment details' })
  @ApiTooManyRequestsResponse({ description: 'Too many requests' })
  @ApiInternalServerErrorResponse({ description: 'Payment gateway error' })
  async initializePayment(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: CreatePaymentDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<PaymentResponseDto> {
    // Check if transaction with this reference already exists
    const existingTransaction =
      await this.paymentService.findTransactionByReference(dto.reference);
    if (existingTransaction) {
      throw new ConflictException(
        `Transaction with reference ${dto.reference} already exists`,
      );
    }

    // Add request context for audit trail
    const requestContext = { ipAddress, userAgent };

    return this.paymentService.initializePayment(dto, requestContext);
  }

  /**
   * Get payment transaction details by reference
   */
  @Get(':reference')
  @UseGuards(ReferenceGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get payment details' })
  @ApiParam({ name: 'reference', description: 'Payment reference' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment details retrieved successfully',
    type: PaymentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid reference format' })
  @ApiTooManyRequestsResponse({ description: 'Too many requests' })
  async getPaymentDetails(
    @Param('reference') reference: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.getPaymentDetails(reference);
  }

  /**
   * Verify a Paystack transaction by its reference.
   * Returns the verified transaction data.
   */
  @Get('verify/:reference')
  @UseGuards(ReferenceGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify payment status' })
  @ApiParam({ name: 'reference', description: 'Payment reference to verify' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment verification successful',
    type: PaymentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid reference format' })
  @ApiTooManyRequestsResponse({ description: 'Too many requests' })
  @ApiInternalServerErrorResponse({
    description: 'Payment verification failed',
  })
  async verifyPayment(
    @Param('reference') reference: string,
  ): Promise<PaymentResponseDto> {
    const verifyDto = new VerifyPaymentDto();
    verifyDto.reference = reference;
    return this.paymentService.verifyPayment(verifyDto);
  }

  /**
   * Process a refund for a completed payment
   */
  @Post('refund')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // Even stricter rate limit for refunds
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund a payment' })
  @ApiBody({ type: RefundPaymentDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund processed successfully',
    type: PaymentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid refund details' })
  @ApiTooManyRequestsResponse({ description: 'Too many requests' })
  @ApiInternalServerErrorResponse({ description: 'Refund processing failed' })
  async refundPayment(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: RefundPaymentDto,
  ): Promise<PaymentResponseDto> {
    // Check if transaction exists and is in a refundable state
    const transaction = await this.paymentService.findTransactionByReference(
      dto.reference,
    );

    if (!transaction) {
      throw new BadRequestException(
        `Transaction with reference ${dto.reference} not found`,
      );
    }

    if (transaction.status !== 'success') {
      throw new BadRequestException(
        `Only successful transactions can be refunded. Current status: ${transaction.status}`,
      );
    }

    return this.paymentService.refundPayment(dto);
  }

  /**
   * Handle Paystack webhook events
   * This endpoint receives events from Paystack webhook
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Paystack webhook events' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook processed' })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing webhook signature',
  })
  @ApiHeader({
    name: 'x-paystack-signature',
    description: 'Paystack signature for verifying webhook authenticity',
    required: true,
  })
  async handleWebhook(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    )
    payload: WebhookPayloadDto,
    @Headers('x-paystack-signature') signature: string,
    @Ip() ipAddress: string,
  ): Promise<{ success: boolean }> {
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    // Use the Paystack API IP whitelist to validate webhook origin
    const isValidIp = await this.paymentService.isValidPaystackIp(ipAddress);
    if (!isValidIp) {
      throw new UnauthorizedException('Unauthorized webhook source');
    }

    const isValid = this.paymentService.verifyWebhookSignature(
      payload,
      signature,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    await this.paymentService.processWebhookEvent(payload);
    return { success: true };
  }
}
