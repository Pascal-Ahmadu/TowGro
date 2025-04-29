import { Injectable, Logger } from '@nestjs/common';
import { SendEmailDto, SendSmsDto } from './dto/create-notification.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { Twilio } from 'twilio';
import { Dispatch } from '../dispatch/entities/dispatch.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { Notification } from './entities/notification.entity';
import { Repository } from 'typeorm';

@Injectable()
export class NotificationsService {
  private readonly twilioClient: Twilio;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly trackingGateway: TrackingGateway,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>
  ) {
    this.twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendEmail(emailData: SendEmailDto): Promise<void> {
    await this.mailerService.sendMail({
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html
    });
  }

  async sendSms(smsData: SendSmsDto): Promise<void> {
    await this.twilioClient.messages.create({
      body: smsData.message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: smsData.to
    });
  }

  /**
   * Send status update notification for a dispatch
   * @param dispatch The dispatch with updated status
   */
  async sendStatusUpdate(dispatch: Dispatch): Promise<void> {
    this.logger.log(`Sending status update notification for dispatch ${dispatch.id}: ${dispatch.status}`);
    
    if (!dispatch.user?.email) {
      this.logger.warn(`No email available for user associated with dispatch ${dispatch.id}`);
      return;
    }
    
    // Create status-specific message
    let subject = 'Update on Your Dispatch Request';
    let message = '';
    
    switch (dispatch.status) {
      case 'assigned':
        message = 'Your dispatch request has been assigned to a driver and will be picked up soon.';
        break;
      case 'en_route':
        message = 'Your driver is on the way to the pickup location.';
        break;
      case 'in_progress':
        message = 'Your dispatch is now in progress.';
        break;
      case 'completed':
        message = 'Your dispatch has been completed successfully.';
        break;
      default:
        message = `The status of your dispatch has been updated to: ${dispatch.status}`;
    }
    
    // Send email notification
    await this.sendEmail({
      to: dispatch.user.email,
      subject,
      text: message,
      html: `<h2>Dispatch Update</h2><p>${message}</p><p>Dispatch ID: ${dispatch.id}</p>`
    });
    
    // Send SMS if phone number available
    if (dispatch.user?.phoneNumber) {
      await this.sendSms({
        to: dispatch.user.phoneNumber,
        message: `Dispatch Update: ${message}`
      });
    }
  }

  /**
   * Send payment notification
   * @param dispatch The dispatch with payment information
   */
  async sendPaymentNotification(dispatch: Dispatch): Promise<void> {
    this.logger.log(`Sending payment notification for dispatch ${dispatch.id}`);
    
    if (!dispatch.user?.email) {
      this.logger.warn(`No email available for payment notification - dispatch ${dispatch.id}`);
      return;
    }
    
    const amount = dispatch.paymentAmount ? 
      (dispatch.paymentAmount / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }) : 
      'N/A';
    
    const emailData: SendEmailDto = {
      to: dispatch.user.email,
      subject: 'Payment Required for Your Dispatch',
      text: `Please complete payment of ${amount} for your dispatch. Click here to pay: ${dispatch.paymentUrl}`,
      html: `
        <h2>Payment Required</h2>
        <p>Your dispatch service requires payment before completion.</p>
        <p><strong>Amount:</strong> ${amount}</p>
        <p><strong>Reference:</strong> ${dispatch.paymentReference}</p>
        <a href="${dispatch.paymentUrl}" style="padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Complete Payment</a>
        <p>Dispatch ID: ${dispatch.id}</p>
      `
    };
    
    await this.sendEmail(emailData);
    
    // Send SMS if phone number available
    if (dispatch.user?.phoneNumber) {
      await this.sendSms({
        to: dispatch.user.phoneNumber,
        message: `Payment Required: ${amount} for your dispatch. Pay here: ${dispatch.paymentUrl}`
      });
    }
  }

  /**
   * Send payment confirmation
   * @param dispatch The dispatch with verified payment
   */
  async sendPaymentConfirmation(dispatch: Dispatch): Promise<void> {
    this.logger.log(`Sending payment confirmation for dispatch ${dispatch.id}`);
    
    if (!dispatch.user?.email) {
      this.logger.warn(`No email available for payment confirmation - dispatch ${dispatch.id}`);
      return;
    }
    
    const amount = dispatch.paymentAmount ? 
      (dispatch.paymentAmount / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }) : 
      'N/A';
    
    const emailData: SendEmailDto = {
      to: dispatch.user.email,
      subject: 'Payment Confirmed - Thank You!',
      text: `Your payment of ${amount} for dispatch ${dispatch.id} has been confirmed. Thank you for your business!`,
      html: `
        <h2>Payment Confirmed</h2>
        <p>Your payment for dispatch service has been successfully processed.</p>
        <p><strong>Amount:</strong> ${amount}</p>
        <p><strong>Reference:</strong> ${dispatch.paymentReference}</p>
        <p><strong>Date:</strong> ${dispatch.paymentVerifiedAt?.toLocaleString() || 'N/A'}</p>
        <p>Thank you for your business!</p>
        <p>Dispatch ID: ${dispatch.id}</p>
      `
    };
    
    await this.sendEmail(emailData);
    
    // Send SMS if phone number available
    if (dispatch.user?.phoneNumber) {
      await this.sendSms({
        to: dispatch.user.phoneNumber,
        message: `Payment Confirmed: ${amount} for your dispatch. Thank you!`
      });
    }
  }
}