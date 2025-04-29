import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendVerificationEmail(
    email: string,
    verificationUrl: string,
  ): Promise<void> {
    const appName = this.configService.get('APP_NAME', 'Auth Service');

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Verify your email for ${appName}`,
        template: 'email-verification', // Create this template in your templates folder
        context: {
          verificationUrl,
          appName,
        },
        text: `Please verify your email by clicking on the following link: ${verificationUrl}`,
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}`,
        error.stack,
      );
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const appName = this.configService.get('APP_NAME', 'Auth Service');

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Reset your password for ${appName}`,
        template: 'password-reset', // Create this template in your templates folder
        context: {
          resetUrl,
          appName,
        },
        text: `Reset your password by clicking on the following link: ${resetUrl}`,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error.stack,
      );
      throw error;
    }
  }

  async sendNotificationEmail(
    email: string,
    content: string,
    type: string,
  ): Promise<void> {
    const appName = this.configService.get('APP_NAME', 'Auth Service');

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `${appName} Notification: ${type}`,
        text: content,
        html: `<p>${content}</p>`,
      });
      this.logger.log(`Notification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send notification email to ${email}`,
        error.stack,
      );
      throw error;
    }
  }
}
