import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: (val) => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;

          // Record metrics
          this.metricsService.incrementHttpRequests(method, url, statusCode);
          this.metricsService.observeHttpDuration(
            method,
            url,
            (Date.now() - now) / 1000,
          );

          return val;
        },
        error: (err) => {
          const statusCode = err.status || 500;

          // Record error metrics
          this.metricsService.incrementHttpRequests(method, url, statusCode);
          this.metricsService.observeHttpDuration(
            method,
            url,
            (Date.now() - now) / 1000,
          );
        },
      }),
    );
  }
}
