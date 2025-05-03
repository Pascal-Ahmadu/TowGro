// src/common/redis/redis.factory.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisFactory {
  constructor(private configService: ConfigService) {}

  createClient(): Redis {
    // First check if REDIS_URL is available
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (redisUrl) {
      console.log('Using REDIS_URL for connection');
      return new Redis(redisUrl, {
        lazyConnect: false,
        reconnectOnError: (err) => {
          console.log(`Redis reconnect on error: ${err.message}`);
          return true;
        },
        retryStrategy: (times) => {
          console.log(`Redis retry attempt ${times}`);
          return Math.min(times * 100, 3000);
        },
      });
    }
    
    // Fallback to individual connection parameters
    const host = this.configService.get<string>('REDIS_HOST', 'redis');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    console.log(`Using Redis connection params: ${host}:${port}`);
    
    return new Redis({
      host,
      port,
      password,
      lazyConnect: false,
      reconnectOnError: (err) => {
        console.log(`Redis reconnect on error: ${err.message}`);
        return true;
      },
      retryStrategy: (times) => {
        console.log(`Redis retry attempt ${times}`);
        return Math.min(times * 100, 3000);
      },
    });
  }
}
