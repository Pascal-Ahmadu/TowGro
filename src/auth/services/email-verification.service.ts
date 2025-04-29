import { Injectable, BadRequestException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from '../../mail/mail.service';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class EmailVerificationService {
  private readonly tokenExpiration: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.tokenExpiration = this.configService.get(
      'EMAIL_VERIFICATION_EXPIRATION',
      86400,
    ); // 24 hours default
  }

  async sendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    const token = uuidv4();

    // Store token in Redis with expiration
    await this.redis.set(
      `email_verification:${token}`,
      userId,
      'EX',
      this.tokenExpiration,
    );

    // Send verification email
    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${token}`;
    await this.mailService.sendVerificationEmail(user.email, verificationUrl);

    return { message: 'Verification email sent' };
  }

  async verifyEmail(token: string) {
    const userId = await this.redis.get(`email_verification:${token}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Mark email as verified
    await this.usersService.markEmailAsVerified(userId);

    // Delete the token to prevent reuse
    await this.redis.del(`email_verification:${token}`);

    return { message: 'Email verified successfully' };
  }
}
