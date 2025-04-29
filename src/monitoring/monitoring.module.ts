import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [
    MetricsService,
    {
      provide: 'PROM_METRIC_HTTP_REQUESTS_TOTAL',
      useFactory: () => new Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'statusCode'],
      }),
    },
    {
      provide: 'PROM_METRIC_LOGIN_ATTEMPTS_TOTAL',
      useFactory: () => new Counter({
        name: 'login_attempts_total',
        help: 'Total number of login attempts',
        labelNames: ['success'],
      }),
    },
    {
      provide: 'PROM_METRIC_ACTIVE_USERS',
      useFactory: () => new Gauge({
        name: 'active_users',
        help: 'Number of currently active users',
      }),
    },
    {
      provide: 'PROM_METRIC_HTTP_REQUEST_DURATION_SECONDS',
      useFactory: () => new Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route'],
      }),
    },
    {
      provide: Registry,
      useFactory: () => new Registry(),
    },
  ],
  exports: [MetricsService],
})
export class MonitoringModule {}