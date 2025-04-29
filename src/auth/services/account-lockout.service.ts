import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class AccountLockoutService {
  private readonly MAX_ATTEMPTS = 5; // Change from 3 to 5
  private readonly LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds
  private readonly ATTEMPT_EXPIRY = 60 * 60; // 1 hour in seconds
  private readonly logger = new Logger(AccountLockoutService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.logger.log('AccountLockoutService initialized');
  }

  async recordFailedAttempt(username: string): Promise<boolean> {
    try {
      const key = `login_attempts:${username}`;
      const attempts = await this.redis.incr(key);
      
      if (attempts === 1) {
        await this.redis.expire(key, this.ATTEMPT_EXPIRY);
      }

      if (attempts >= this.MAX_ATTEMPTS) {
        const lockKey = `account_locked:${username}`;
        await this.redis.set(lockKey, '1', 'EX', this.LOCKOUT_DURATION);
        this.logger.warn(`Account locked for user: ${username}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error recording failed attempt: ${error.message}`);
      return false; // Don't lock the account if there's an error
    }
  }

  async isAccountLocked(username: string): Promise<boolean> {
    try {
      const lockKey = `account_locked:${username}`;
      return Boolean(await this.redis.exists(lockKey));
    } catch (error) {
      this.logger.error(`Error checking account lock: ${error.message}`);
      return false; // Don't block login if there's an error checking
    }
  }

  async resetAttempts(username: string): Promise<void> {
    try {
      const key = `login_attempts:${username}`;
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Error resetting attempts: ${error.message}`);
    }
  }
  
  async clearLockout(username: string): Promise<void> {
    try {
      const lockKey = `account_locked:${username}`;
      const attemptsKey = `login_attempts:${username}`;
      
      // Delete both the lock and the attempts counter
      await this.redis.del(lockKey);
      await this.redis.del(attemptsKey);
      this.logger.log(`Lockout cleared for user: ${username}`);
    } catch (error) {
      this.logger.error(`Error clearing lockout: ${error.message}`);
    }
  }
  
  async getAttemptCount(username: string): Promise<number> {
    try {
      const key = `login_attempts:${username}`;
      const count = await this.redis.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      this.logger.error(`Error getting attempt count: ${error.message}`);
      return 0;
    }
  }
}