// src/common/redis/redis.factory.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisFactory {
  constructor(private configService: ConfigService) {}

  createClient(): Redis {
    const host = this.configService.get<string>('REDIS_HOST', 'redis');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    console.log(`Creating Redis client with connection to ${host}:${port}`);

    return new Redis({
      host,
      port,
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
