import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator } from '@nestjs/terminus';
import { Redis } from 'ioredis';

@Injectable()
export class RedisHealth extends HealthIndicator {
  constructor(
    @Inject('REDIS_CLIENT') 
    private readonly redis: Redis
  ) {
    super();
  }

  async isHealthy(key: string) {
    try {
      await this.redis.ping();
      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError('Redis failed', this.getStatus(key, false));
    }
  }
}