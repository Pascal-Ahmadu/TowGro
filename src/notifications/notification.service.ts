import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from './enums/notification-type.enum';
import { UsersService } from '../users/users.service';
// Add missing import
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly twilioClient: Twilio;

  constructor(
    private readonly mailService: MailService,
    private readonly trackingGateway: TrackingGateway,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {
    // Initialize Twilio client if credentials are provided
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
    
    if (accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
    }
  }

  // Original method renamed to sendTypedNotification to avoid duplication
  async sendTypedNotification(userId: string, type: NotificationType, content: string, metadata?: any) {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        this.logger.warn(`Attempted to send notification to non-existent user: ${userId}`);
        return false;
      }

      // Save notification to database
      const notification = await this.notificationRepository.save({
        userId,
        type,
        content,
        metadata: metadata || {},
        read: false,
        createdAt: new Date(),
      });

      // Send real-time notification via WebSocket
      this.trackingGateway.server.to(`user_${userId}`).emit('notification', {
        id: notification.id,
        type,
        content,
        metadata: metadata || {},
        timestamp: notification.createdAt.toISOString(),
      });

      // Send via email if user has email notifications enabled
      if (user.preferences?.emailNotifications) {
        await this.mailService.sendNotificationEmail(user.email, content, type);
      }

      // Send via SMS if user has SMS notifications enabled and phone number is provided
      if (user.preferences?.smsNotifications && user.phoneNumber && this.twilioClient) {
        const twilioPhoneNumber = this.configService.get('TWILIO_PHONE_NUMBER');
        await this.twilioClient.messages.create({
          body: content,
          from: twilioPhoneNumber,
          to: user.phoneNumber,
        });
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`, error.stack);
      return false;
    }
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { read: true, readAt: new Date() }
    );
    return true;
  }

  async getUserNotifications(userId: string, limit = 20, offset = 0) {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getUnreadCount(userId: string) {
    return this.notificationRepository.count({
      where: { userId, read: false },
    });
  }

  // Enhanced notification method with DTO
  async sendNotification(userId: string, notification: CreateNotificationDto) {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        this.logger.warn(`Attempted to send notification to non-existent user: ${userId}`);
        return null;
      }
      
      // Store in database
      const savedNotification = await this.notificationRepository.save({
        userId,
        type: NotificationType.GENERAL, // Default type
        content: notification.content,
        metadata: {},
        read: false,
        createdAt: new Date(),
      });
      
      // Send via WebSocket if user is online
      this.trackingGateway.server.to(`user_${userId}`).emit('notification', {
        id: savedNotification.id,
        content: notification.content,
        timestamp: savedNotification.createdAt.toISOString(),
      });
      
      // Send via email if it's important
      if (user.email && notification.importance === 'high') {
        await this.mailService.sendNotificationEmail(
          user.email,
          notification.content,
          'IMPORTANT'
        );
      }
      
      return savedNotification;
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`, error.stack);
      return null;
    }
  }
}