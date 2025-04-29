import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { AccountLockoutService } from '../services/account-lockout.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(LocalStrategy.name);
  
  constructor(
    private authService: AuthService,
    private accountLockoutService: AccountLockoutService
  ) {
    super({
      usernameField: 'identifier', // Using identifier for email/phone
    });
  }

  async validate(identifier: string, password: string): Promise<any> {
    this.logger.debug(`Attempting to validate user: ${identifier}`);
    
    // First check if account is locked
    const isLocked = await this.accountLockoutService.isAccountLocked(identifier);
    if (isLocked) {
      this.logger.warn(`Account locked: ${identifier}`);
      throw new UnauthorizedException('Account temporarily locked due to too many failed login attempts');
    }

    try {
      // Attempt to authenticate user
      const user = await this.authService.validateUser(identifier, password);
      
      if (!user) {
        this.logger.warn(`Authentication failed for: ${identifier}`);
        const lockout = await this.accountLockoutService.recordFailedAttempt(identifier);
        if (lockout) {
          throw new UnauthorizedException('Account temporarily locked due to too many failed login attempts');
        }
        throw new UnauthorizedException('Invalid credentials');
      }
      
      // Reset attempts on successful login
      await this.accountLockoutService.resetAttempts(identifier);
      this.logger.debug(`Authentication successful for: ${identifier}`);
      
      return user;
    } catch (error) {
      // Record failed attempt and check for lockout
      this.logger.error(`Authentication error: ${error.message}`);
      await this.accountLockoutService.recordFailedAttempt(identifier);
      throw error;
    }
  }
}