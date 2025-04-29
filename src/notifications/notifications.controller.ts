import { Controller, Post, Body } from '@nestjs/common';
import { SendEmailDto, SendSmsDto } from './dto/create-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('email')
  async sendEmail(@Body() emailData: SendEmailDto) {
    await this.notificationsService.sendEmail(emailData);
    return { 
      status: 'Email queued',
      to: emailData.to,
      subject: emailData.subject
    };
  }

  @Post('sms')
  async sendSms(@Body() smsData: SendSmsDto) {
    await this.notificationsService.sendSms(smsData);
    return {
      status: 'SMS queued',
      to: smsData.to,
      message: smsData.message
    };
  }
}
