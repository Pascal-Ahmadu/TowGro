// src/common/redis/redis.factory.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisFactory {
  private readonly logger = new Logger(RedisFactory.name);
  
  constructor(private configService: ConfigService) {}

  createClient(): Redis {
    // First check if REDIS_URL is available
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (redisUrl) {
      this.logger.log(`Using REDIS_URL for connection: ${redisUrl.split('@').pop()}`); // Only log host part for security
      return new Redis(redisUrl, {
        lazyConnect: false,
        reconnectOnError: (err) => {
          this.logger.error(`Redis reconnect on error: ${err.message}`);
          return true;
        },
        retryStrategy: (times) => {
          this.logger.log(`Redis retry attempt ${times}`);
          return Math.min(times * 100, 3000);
        },
        // Add more detailed connection options
        enableOfflineQueue: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
      });
    }
    
    // Fallback to individual connection parameters
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    this.logger.log(`Using Redis connection params: ${host}:${port}`);
    
    return new Redis({
      host,
      port,
      password: password || undefined, // Only set if password exists
      lazyConnect: false,
      reconnectOnError: (err) => {
        this.logger.error(`Redis reconnect on error: ${err.message}`);
        return true;
      },
      retryStrategy: (times) => {
        this.logger.log(`Redis retry attempt ${times}`);
        return Math.min(times * 100, 3000);
      },
      // Add more detailed connection options
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
    });
  }
}
