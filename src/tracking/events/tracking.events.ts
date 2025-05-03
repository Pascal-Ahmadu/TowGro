// src/tracking/events/tracking.events.ts
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { UpdateLocationDto } from '../dto/tracking.dto';

@Injectable()
export class TrackingEvents implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingEvents.name);
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private readonly useRedis: boolean;

  constructor(private configService: ConfigService) {
    this.useRedis = this.configService.get<boolean>('USE_REDIS') !== false;
  }

  async onModuleInit() {
    if (this.useRedis) {
      await this.setupRedisClients();
    }
  }

  async onModuleDestroy() {
    if (this.useRedis) {
      await this.closeRedisClients();
    }
  }

  async publishLocationUpdate(dto: UpdateLocationDto): Promise<void> {
    if (!this.useRedis) return;

    try {
      await this.publisher.publish(
        'tracking:location:update',
        JSON.stringify(dto),
      );
    } catch (error) {
      this.logger.error(`Failed to publish location update: ${error.message}`);
      // Don't throw - we want to degrade gracefully if Redis is unavailable
    }
  }

  private async setupRedisClients() {
    try {
      // Directly use REDIS_URL if available
      const redisUrl = this.configService.get<string>('REDIS_URL');
      
      if (redisUrl) {
        this.logger.log('Using REDIS_URL for connection');
        this.publisher = createClient({ url: redisUrl });
        this.subscriber = this.publisher.duplicate();
      } else {
        // Fallback to individual parameters only if URL is not available
        const host = this.configService.get('REDIS_HOST', 'localhost');
        const port = this.configService.get('REDIS_PORT', 6379);
        const password = this.configService.get('REDIS_PASSWORD', '');
        
        this.logger.log(`Using Redis connection params: ${host}:${port}`);
        
        const options: any = { 
          socket: {
            host,
            port
          }
        };
        
        if (password) {
          options.password = password;
        }
        
        this.publisher = createClient(options);
        this.subscriber = this.publisher.duplicate();
      }

      this.publisher.on('error', (err) => {
        this.logger.error(`Redis publisher error: ${err.message}`);
      });

      this.subscriber.on('error', (err) => {
        this.logger.error(`Redis subscriber error: ${err.message}`);
      });

      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);

      this.logger.log('Redis event clients connected');
    } catch (error) {
      this.logger.error(`Failed to setup Redis clients: ${error.message}`);
    }
  }

  private async closeRedisClients() {
    try {
      await Promise.all([
        this.publisher?.disconnect(),
        this.subscriber?.disconnect(),
      ]);

      this.logger.log('Redis event clients disconnected');
    } catch (error) {
      this.logger.error(`Error closing Redis clients: ${error.message}`);
    }
  }
}
