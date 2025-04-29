import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealth } from './redis-health';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redisHealth: RedisHealth,
  ) {}

  @Get()
  @Public()
  check() {
    return this.health.check([
      // Remove the HTTP check since it requires authentication
      () => this.db.pingCheck('database'),
      () => this.redisHealth.isHealthy('redis'),
      // Add memory check
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      // Add disk check
      () =>
        this.disk.checkStorage('disk', { path: 'C:\\', thresholdPercent: 0.9 }),
    ]);
  }
}
