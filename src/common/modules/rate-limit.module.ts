import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL', 60) * 1000, // Default: 60 seconds
            limit: config.get('THROTTLE_LIMIT', 10), // Default: 10 requests per TTL
          },
        ],
        storage: undefined, // Use in-memory storage by default
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}