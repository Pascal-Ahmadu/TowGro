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
    
    // Add explicit connection configuration
    return new Redis(redisUrl, {
      port: 6379,
      host: 'red-d08c11ngi27c738dr6t0',
      maxRetriesPerRequest: 5,
      connectTimeout: 10000,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      // Explicitly disable TLS if not needed
      tls: redisUrl.startsWith('rediss://') ? {} : undefined
    });
  }
}
