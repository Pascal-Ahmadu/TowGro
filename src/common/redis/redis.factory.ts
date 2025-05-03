// src/common/redis/redis.factory.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisFactory {
  private readonly logger = new Logger(RedisFactory.name);
  
  constructor(private configService: ConfigService) {}

  createClient(): Redis {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }

    // Validate URL format
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      throw new Error('Invalid REDIS_URL format - must start with redis:// or rediss://');
    }

    return new Redis(redisUrl, {
      maxRetriesPerRequest: 5,
      connectTimeout: 10000,
      retryStrategy: (times) => Math.min(times * 200, 5000)
    });
  }
}
