import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from '../../mail/mail.service';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class PasswordResetService {
  private readonly tokenExpiration: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.tokenExpiration = this.configService.get('PASSWORD_RESET_EXPIRATION', 3600); // 1 hour default
  }

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return { message: 'If your email is registered, you will receive a password reset link' };
    }

    const token = uuidv4();
    
    // Store token in Redis with expiration
    await this.redis.set(
      `password_reset:${token}`,
      user.id,
      'EX',
      this.tokenExpiration
    );

    // Send email with reset link
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;
    await this.mailService.sendPasswordResetEmail(user.email, resetUrl);

    return { message: 'If your email is registered, you will receive a password reset link' };
  }

  async validateResetToken(token: string) {
    const userId = await this.redis.get(`password_reset:${token}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired token');
    }
    return true;
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = await this.redis.get(`password_reset:${token}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Update the user's password
    await this.usersService.updatePassword(userId, newPassword);
    
    // Delete the token to prevent reuse
    await this.redis.del(`password_reset:${token}`);

    return { message: 'Password reset successfully' };
  }
}