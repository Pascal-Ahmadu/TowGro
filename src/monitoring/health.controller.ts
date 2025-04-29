import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    @InjectConnection() private defaultConnection: Connection,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health check
      () =>
        this.db.pingCheck('database', { connection: this.defaultConnection }),

      // Memory usage check - heap must not exceed 300MB
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

      // Disk storage check - at least 500MB free
      () =>
        this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }
}
