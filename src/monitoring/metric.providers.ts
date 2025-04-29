// metric.providers.ts
import { Provider } from '@nestjs/common';
import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

export const metricProviders: Provider[] = [
  makeCounterProvider({
    name: 'app_http_requests_total', // Include prefix in name directly
    help: 'Total number of HTTP requests',
  }),
  makeCounterProvider({
    name: 'app_login_attempts_total',
    help: 'Total login attempts',
  }),
  makeGaugeProvider({
    name: 'app_active_users',
    help: 'Current number of active users',
  }),
  makeHistogramProvider({
    name: 'app_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  }),
];
