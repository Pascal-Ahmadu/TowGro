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

    this.logger.log(`Using Redis URL: ${redisUrl.split('@')[1]}`); // Only show host:port
    
    return new Redis(redisUrl, {
      maxRetriesPerRequest: 5,
      connectTimeout: 10000,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      reconnectOnError: (err) => {
        this.logger.error(`Redis connection error: ${err.message}`);
        return true;
      }
    });
  }
}
