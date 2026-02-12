import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { sanitizeUrl, sanitizeError } from '../utils/sanitize.util';

const REQUEST_ID_HEADER = 'x-request-id';

type RequestWithId = Request & { id?: string; [REQUEST_ID_HEADER]?: string };

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    const started = Date.now();
    const requestId = this.resolveRequestId(request);

    response.setHeader(REQUEST_ID_HEADER, requestId);
    request[REQUEST_ID_HEADER] = requestId;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - started;
          this.logRequest(request, response, duration, requestId);
        },
        error: (err: unknown) => {
          const duration = Date.now() - started;
          this.logError(request, response, duration, requestId, err);
          throw err;
        },
      }),
    );
  }

  private resolveRequestId(request: RequestWithId): string {
    const raw = request.headers[REQUEST_ID_HEADER];
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
    if (typeof request.id === 'string') return request.id;
    return randomUUID();
  }

  /**
   * Log successful HTTP request
   */
  private logRequest(
    request: RequestWithId,
    response: Response,
    duration: number,
    requestId: string,
  ): void {
    const method = request.method ?? 'UNKNOWN';
    const url = sanitizeUrl(request.url ?? '');
    const status = response.statusCode ?? 0;

    this.logger.log({
      msg: 'HTTP Request',
      method,
      url,
      status,
      duration,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log HTTP request error
   */
  private logError(
    request: RequestWithId,
    response: Response,
    duration: number,
    requestId: string,
    error: unknown,
  ): void {
    const method = request.method ?? 'UNKNOWN';
    const url = sanitizeUrl(request.url ?? '');
    const status = response.statusCode ?? 500;

    this.logger.error({
      msg: 'HTTP Request Failed',
      method,
      url,
      status,
      duration,
      requestId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      error: sanitizeError(error),
      timestamp: new Date().toISOString(),
    });
  }
}
