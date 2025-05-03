import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import redisConfig from './redis.config';

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule.forFeature(redisConfig)],
      useFactory: (config: ConfigService) => {
        // Check for REDIS_URL first
        const redisUrl = config.get('REDIS_URL');
        
        if (redisUrl) {
          return {
            type: 'single',
            url: redisUrl,
          };
        }
        
        // Fallback to individual parameters
        return {
          type: 'single',
          options: {
            host: config.get('redis.host'),
            port: config.get('redis.port'),
            password: config.get('redis.password'),
            tls: config.get('redis.host') !== 'localhost' ? {} : undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [RedisModule],
})
export class RedisConnectionModule {}
