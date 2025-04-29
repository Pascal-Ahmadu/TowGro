// src/common/throttler/redis-throttler.storage.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { RedisFactory } from '../redis/redis.factory';

const KEY_PREFIX = 'throttle:';

interface StorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private redis: Redis;

  constructor(private redisFactory: RedisFactory) {
    // Create a dedicated Redis client for throttling
    this.redis = this.redisFactory.createClient();

    // Handle connection errors to prevent unhandled errors
    this.redis.on('error', (err) => {
      console.error('Redis throttler storage error:', err.message);
    });
  }

  async increment(key: string, ttl: number): Promise<StorageRecord> {
    const redisKey = `${KEY_PREFIX}${key}`;

    try {
      const storedValue = await this.redis
        .multi()
        .incr(redisKey)
        .pttl(redisKey)
        .exec();

      const totalHits = storedValue[0][1] as number;
      let timeToExpire = storedValue[1][1] as number;

      if (totalHits === 1) {
        await this.redis.pexpire(redisKey, ttl * 1000);
        timeToExpire = ttl * 1000;
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (error) {
      console.error(`Redis throttler increment error: ${error.message}`);
      // Return a default record if Redis fails
      return {
        totalHits: 1,
        timeToExpire: ttl * 1000,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  async getRecord(key: string): Promise<StorageRecord | null> {
    const redisKey = `${KEY_PREFIX}${key}`;

    try {
      const [count, ttl] = await Promise.all([
        this.redis.get(redisKey),
        this.redis.pttl(redisKey),
      ]);

      if (!count) {
        return null;
      }

      return {
        totalHits: parseInt(count, 10),
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (error) {
      console.error(`Redis throttler getRecord error: ${error.message}`);
      return null;
    }
  }
}
