import { Injectable, BadRequestException, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispatch } from './entities/dispatch.entity';
import { CreateDispatchDto } from './dto/create-dispatch.dto';
import { DispatchStatusDto } from './dto/dispatch-status.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentService } from '../payment/payment.service';
// Update import path for payment DTO
import { CreatePaymentDto } from '../payment/dto/payment.dto';

/**
 * Enum for dispatch statuses
 */
export enum DispatchStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  EN_ROUTE = 'en_route',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_COMPLETED = 'payment_completed',
  FAILED = 'failed'
}

/**
 * Service responsible for handling dispatch-related operations
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    @InjectRepository(Dispatch)
    private readonly dispatchRepository: Repository<Dispatch>,
    private readonly notificationService: NotificationsService,
    private readonly paymentService: PaymentService
  ) {}

  /**
   * Creates a new dispatch request
   * @param createDispatchDto - The dispatch creation data
   * @returns The created dispatch entity
   */
  async createDispatch(createDispatchDto: CreateDispatchDto): Promise<Dispatch> {
    try {
      const dispatch = this.dispatchRepository.create({
        userId: createDispatchDto.userId,
        pickupLat: createDispatchDto.pickupLat,
        pickupLng: createDispatchDto.pickupLng,
        status: DispatchStatus.PENDING,
        // Store vehicleType if added to Dispatch entity
      });
      
      const savedDispatch = await this.dispatchRepository.save(dispatch);
      this.logger.log(`Created dispatch with ID: ${savedDispatch.id}`);
      return savedDispatch;
    } catch (error) {
      this.logger.error(`Failed to create dispatch: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to create dispatch request');
    }
  }

  /**
   * Retrieves the status of a dispatch by ID
   * @param id - The UUID of the dispatch
   * @returns The dispatch status data
   * @throws NotFoundException if dispatch not found
   */
  async getDispatchStatus(id: string): Promise<DispatchStatusDto> {
    try {
      const dispatch = await this.dispatchRepository.findOne({ 
        where: { id },
        select: ['id', 'status'] // Optimize query to only select needed fields
      });
      
      if (!dispatch) {
        this.logger.warn(`Dispatch with ID ${id} not found`);
        throw new NotFoundException(`Dispatch with ID ${id} not found`);
      }
      
      return { 
        dispatchId: dispatch.id, 
        status: dispatch.status
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error retrieving dispatch status: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to retrieve dispatch status');
    }
  }

  /**
   * Updates the status of a dispatch
   * @param statusDto - The dispatch status update data
   * @returns The updated dispatch entity
   * @throws NotFoundException if dispatch not found
   */
  async updateDispatchStatus(statusDto: DispatchStatusDto): Promise<Dispatch> {
    const { dispatchId, status } = statusDto;
    
    const dispatch = await this.dispatchRepository.findOne({ where: { id: dispatchId } });
    if (!dispatch) {
      this.logger.warn(`Dispatch with ID ${dispatchId} not found for status update`);
      throw new NotFoundException(`Dispatch with ID ${dispatchId} not found`);
    }
    
    dispatch.status = status;
    
    try {
      const updatedDispatch = await this.dispatchRepository.save(dispatch);
      this.logger.log(`Updated dispatch ${dispatchId} status to ${status}`);
      
      // Trigger notifications if status changes to certain values
      if (['assigned', 'in_progress', 'completed', 'payment_pending'].includes(status)) {
        await this.notificationService.sendStatusUpdate(updatedDispatch);
      }
      
      return updatedDispatch;
    } catch (error) {
      this.logger.error(`Failed to update dispatch status: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to update dispatch status');
    }
  }

  /**
   * Calculate the fee for a dispatch based on distance, time, and vehicle type
   * @param dispatch The dispatch entity
   * @returns The calculated fee in the smallest currency unit (e.g., kobo)
   */
  private calculateFee(dispatch: Dispatch): number {
    // This is a placeholder for your actual fee calculation logic
    // In a real implementation, you would:
    // 1. Calculate distance between pickup and dropoff
    // 2. Factor in time of day, vehicle type, etc.
    // 3. Apply any applicable discounts
    
    const baseFee = 1000; // ₦10 in kobo
    const distanceFee = this.calculateDistanceFee(dispatch);
    const timeFee = this.calculateTimeFee(dispatch);
    const vehicleFee = this.calculateVehicleFee(dispatch);
    
    return baseFee + distanceFee + timeFee + vehicleFee;
  }
  
  /**
   * Calculate the distance-based fee component
   */
  private calculateDistanceFee(dispatch: Dispatch): number {
    // Implement distance fee calculation
    return 0; // Placeholder
  }
  
  /**
   * Calculate the time-based fee component
   */
  private calculateTimeFee(dispatch: Dispatch): number {
    // Implement time fee calculation
    return 0; // Placeholder
  }
  
  /**
   * Calculate the vehicle-based fee component
   */
  private calculateVehicleFee(dispatch: Dispatch): number {
    // Implement vehicle fee calculation
    return 0; // Placeholder
  }

  /**
   * Complete a dispatch and initiate payment
   * @param id The dispatch ID
   * @returns The updated dispatch with payment information
   */
  async completeDispatch(id: string): Promise<Dispatch> {
    this.logger.log(`Completing dispatch with ID: ${id}`);
    
    // Use transaction to ensure data consistency
    return this.dispatchRepository.manager.transaction(async (transactionalEntityManager) => {
      // Find dispatch with relations needed for payment processing
      const dispatch = await transactionalEntityManager.findOne(Dispatch, {
        where: { id },
        relations: ['user'] // Assuming user relation exists
      });
      
      if (!dispatch) {
        this.logger.warn(`Dispatch with ID ${id} not found for completion`);
        throw new NotFoundException(`Dispatch with ID ${id} not found`);
      }
      
      // Validate dispatch can be completed
      if (dispatch.status !== DispatchStatus.IN_PROGRESS) {
        this.logger.warn(`Cannot complete dispatch with status ${dispatch.status}`);
        throw new BadRequestException(`Only dispatches with status 'in_progress' can be completed`);
      }
      
      try {
        // Update status to payment_pending before initiating payment
        dispatch.status = DispatchStatus.PAYMENT_PENDING;
        await transactionalEntityManager.save(dispatch);
        
        // Create payment payload with proper currency and amount
        const amount = this.calculateFee(dispatch);
        const customerEmail = dispatch.user?.email || 'customer@example.com'; // Fallback for testing
        
        const paymentDto: CreatePaymentDto = {
          reference: `DSP_${dispatch.id}`,
          customerEmail,
          amount,
          currency: 'NGN',
          metadata: {
            dispatchId: dispatch.id,
            userId: dispatch.userId,
            completedAt: new Date().toISOString()
          }
        };
        
        // Initialize payment with Paystack
        const paymentResult = await this.paymentService.initializePayment(paymentDto);
        
        if (!paymentResult.success) {
          throw new Error(paymentResult.error || 'Payment initialization failed');
        }
        
        // Store payment information in dispatch
        dispatch.paymentReference = paymentResult.data.reference;
        dispatch.paymentUrl = paymentResult.data.authorizationUrl;
        dispatch.paymentAmount = amount;
        dispatch.paymentInitiatedAt = new Date();
        
        // Save the updated dispatch
        const updatedDispatch = await transactionalEntityManager.save(dispatch);
        
        // Send notification about payment requirement
        await this.notificationService.sendPaymentNotification(updatedDispatch);
        
        this.logger.log(`Successfully completed dispatch ${id} and initiated payment`);
        return updatedDispatch;
      } catch (error) {
        this.logger.error(`Failed to complete dispatch: ${error.message}`, error.stack);
        
        // Revert to previous status if payment fails
        dispatch.status = DispatchStatus.IN_PROGRESS;
        await transactionalEntityManager.save(dispatch);
        
        if (error instanceof BadRequestException || error instanceof NotFoundException) {
          throw error;
        }
        
        throw new InternalServerErrorException('Failed to complete dispatch and initialize payment');
      }
    });
  }

  /**
   * Verify payment status for a dispatch
   * @param dispatchId The dispatch ID
   * @returns Updated dispatch with payment status
   */
  async verifyDispatchPayment(dispatchId: string): Promise<Dispatch> {
    const dispatch = await this.dispatchRepository.findOne({ where: { id: dispatchId } });
    
    if (!dispatch) {
      throw new NotFoundException(`Dispatch with ID ${dispatchId} not found`);
    }
    
    if (!dispatch.paymentReference) {
      throw new BadRequestException('No payment has been initiated for this dispatch');
    }
    
    try {
      const verificationResult = await this.paymentService.verifyPayment({ 
        reference: dispatch.paymentReference 
      });
      
      if (verificationResult.success && 
          verificationResult.data.status === 'success') {
        
        // Update dispatch status to payment completed
        dispatch.status = DispatchStatus.PAYMENT_COMPLETED;
        dispatch.paymentVerifiedAt = new Date();
        
        const updatedDispatch = await this.dispatchRepository.save(dispatch);
        
        // Send payment confirmation notification
        await this.notificationService.sendPaymentConfirmation(updatedDispatch);
        
        return updatedDispatch;
      } else {
        // Payment not successful yet
        return dispatch;
      }
    } catch (error) {
      this.logger.error(`Failed to verify payment: ${error.message}`, error.stack);
      throw new BadRequestException('Payment verification failed');
    }
  }

  // Add to DispatchService class
  async getDispatchStatistics() {
    const query = this.dispatchRepository.createQueryBuilder('dispatch')
      .select('status, COUNT(*) as count')
      .groupBy('status');
    
    return {
      statusCounts: await query.getRawMany(),
      total: await this.dispatchRepository.count()
    };
  }

  async findAllDispatches() {
    return this.dispatchRepository.find({
      relations: ['user'],
      order: {
        createdAt: 'DESC'
      } as import('typeorm').FindOptionsOrder<Dispatch>
    });
  }
}  // Add this closing brace to complete the class definition