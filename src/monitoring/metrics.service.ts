import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class MetricsService {
  private metrics = new Map<string, number>();

  constructor(
    // Remove PrometheusService injection
    @InjectMetric('http_requests_total')
    private httpRequestsCounter: Counter<string>,
    @InjectMetric('login_attempts_total')
    private loginAttemptsCounter: Counter<string>,
    @InjectMetric('active_users')
    private activeUsersGauge: Gauge<string>,
    @InjectMetric('http_request_duration_seconds')
    private httpRequestDuration: Histogram<string>,
    private registry: Registry
  ) {
    this.initializeMetrics();
    // Remove registerMetrics() call (already removed)
  }

  // Remove the entire registerMetrics() method
  /* private registerMetrics() {
    this.prometheusService.registerMetrics([
      {
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        type: 'counter',
      },
      // Add other metrics similarly
    ]);
  } */

  // Fix method parameter name to match constructor
  incrementHttpRequests(method: string, route: string, statusCode: number): void {
    this.httpRequestsCounter.inc({ method, route, statusCode: statusCode.toString() });
    
    // Update our metrics map
    const currentRequests = this.metrics.get('http_requests') || 0;
    this.metrics.set('http_requests', currentRequests + 1);
    
    // Update error rate if status code is 4xx or 5xx
    if (statusCode >= 400) {
      const totalRequests = this.metrics.get('http_requests') || 1;
      const errorRequests = (this.metrics.get('error_rate') || 0) * totalRequests + 1;
      this.metrics.set('error_rate', errorRequests / totalRequests);
    }
  }

  // Track login attempts
  incrementLoginAttempts(success: boolean): void {
    this.loginAttemptsCounter.inc({ success: success.toString() });
    
    // Update our metrics map
    const currentAttempts = this.metrics.get('login_attempts') || 0;
    this.metrics.set('login_attempts', currentAttempts + 1);
    
    if (success) {
      const currentSuccessful = this.metrics.get('successful_logins') || 0;
      this.metrics.set('successful_logins', currentSuccessful + 1);
    } else {
      const currentFailed = this.metrics.get('failed_logins') || 0;
      this.metrics.set('failed_logins', currentFailed + 1);
    }
  }

  // Track active users
  setActiveUsers(count: number): void {
    this.activeUsersGauge.set(count);
  }

  // Track HTTP request duration
  // Fix histogram reference
  observeHttpDuration(method: string, route: string, duration: number): void {
    this.httpRequestDuration.observe({ method, route }, duration);
    
    // Update average response time in our metrics map
    const currentAvg = this.metrics.get('response_time_avg') || 0;
    const totalRequests = this.metrics.get('http_requests') || 1;
    const newAvg = ((currentAvg * (totalRequests - 1)) + duration) / totalRequests;
    this.metrics.set('response_time_avg', newAvg);
  }

  // Get a metric by name
  getMetric(metricName: string): number | undefined {
    return this.metrics.get(metricName);
  }

  // For login metrics
  getLoginAttemptsCount(): number {
    // Use the metrics map instead of direct counter access
    return this.metrics.get('login_attempts') || 0;
  }

  getSuccessfulLoginsCount(): number {
    // Use the metrics map instead of direct counter access
    return this.metrics.get('successful_logins') || 0;
  }

  getFailedLoginsCount(): number {
    // Use the metrics map instead of direct counter access
    return this.metrics.get('failed_logins') || 0;
  }

  // For HTTP request metrics
  getHttpRequestsCount(): number {
    // Use the metrics map instead of direct counter access
    return this.metrics.get('http_requests') || 0;
  }

  getAverageResponseTimeValue(): number {
    // Use the metrics map instead of direct histogram access
    return this.metrics.get('response_time_avg') || 0;
  }

  getErrorRateValue(): number {
    // Use the metrics map instead of direct counter access
    return this.metrics.get('error_rate') || 0;
  }

  private initializeMetrics(): void {
    // Auth metrics
    this.metrics.set('login_attempts', 0);
    this.metrics.set('successful_logins', 0);
    this.metrics.set('failed_logins', 0);
    
    // System metrics
    this.metrics.set('http_requests', 0);
    this.metrics.set('response_time_avg', 0);
    this.metrics.set('error_rate', 0);
  }
}