import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async generateTwoFactorSecret(userId: string) {
    const user = await this.usersService.findById(userId);
    const secret = authenticator.generateSecret();
    const appName = this.configService.get('APP_NAME', 'TowGrow');
    
    const otpAuthUrl = authenticator.keyuri(user.email, appName, secret);
    const qrCodeDataUrl = await toDataURL(otpAuthUrl);
    
    // Store the secret temporarily (don't save to user record until verified)
    await this.usersService.storeTempSecret(userId, secret);
    
    return {
      secret,
      qrCodeDataUrl,
    };
  }

  async verifyTwoFactorToken(userId: string, token: string) {
    const user = await this.usersService.findById(userId);
    const secret = user.tempTwoFactorSecret || user.twoFactorSecret;
    
    if (!secret) {
      return false;
    }
    
    return authenticator.verify({
      token,
      secret,
    });
  }

  async enableTwoFactor(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user.tempTwoFactorSecret) {
      throw new Error('Two-factor authentication not set up');
    }
    
    // Move from temporary to permanent storage
    await this.usersService.enableTwoFactor(userId, user.tempTwoFactorSecret);
    return true;
  }

  async disableTwoFactor(userId: string) {
    await this.usersService.disableTwoFactor(userId);
    return true;
  }
}