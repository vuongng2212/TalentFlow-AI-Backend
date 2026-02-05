import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from '../../metrics/metrics.service';

type HttpReq = Request & { route?: { path?: string }; originalUrl?: string };

type HttpRes = Response;

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<HttpReq>();
    const response = http.getResponse<HttpRes>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.observe(request, response, start),
        error: () => this.observe(request, response, start),
      }),
    );
  }

  private observe(request: HttpReq, response: HttpRes, start: bigint) {
    const diffNs = Number(process.hrtime.bigint() - start);
    const durationSeconds = diffNs / 1_000_000_000;
    const status = response.statusCode ?? 500;

    const path = request.originalUrl || request.url || 'unknown';
    const method = request.method || 'UNKNOWN';

    this.metrics.recordRequest(method, path, status, durationSeconds);
  }
}
