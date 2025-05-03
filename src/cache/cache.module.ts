import { Module } from '@nestjs/common';
import { CacheModule as NestJSCacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    NestJSCacheModule.registerAsync({
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL environment variable must be defined');
        }

        return {
          store: redisStore,
          url: redisUrl,
          ttl: 60 * 1000,
        };
      },
    }),
  ],
})
export class RedisCacheModule {}
