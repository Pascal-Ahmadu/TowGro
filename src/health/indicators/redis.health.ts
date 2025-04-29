import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@InjectRedis() private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Ping Redis to check if it's responsive
      const result = await this.redis.ping();
      const isHealthy = result === 'PONG';
      
      const status = this.getStatus(key, isHealthy, { responseTime: `${Date.now()}ms` });
      
      if (isHealthy) {
        return status;
      }
      
      throw new HealthCheckError('Redis health check failed', status);
    } catch (error) {
      const status = this.getStatus(key, false, { message: error.message });
      throw new HealthCheckError('Redis health check failed', status);
    }
  }
}