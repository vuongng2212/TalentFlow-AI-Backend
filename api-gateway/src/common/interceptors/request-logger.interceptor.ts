import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { sanitizeUrl, sanitizeError } from '../utils/sanitize.util';
import { ElkLoggerService } from '../logger';

const REQUEST_ID_HEADER = 'x-request-id';

type RequestWithId = Request & { id?: string; [REQUEST_ID_HEADER]?: string };

/**
 * Logs every incoming HTTP request and its outcome (status, duration, requestId).
 *
 * When ElkLoggerService is available (ELK_HOST configured) the log entries are
 * structured JSON and forwarded to Elasticsearch. Falls back to the NestJS
 * built-in Logger (console) otherwise.
 *
 * Registered as APP_INTERCEPTOR in app.module.ts so it has full DI support.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly fallbackLogger = new Logger('HTTP');

  constructor(
    @Optional() private readonly elkLogger?: ElkLoggerService,
  ) {
    if (elkLogger) {
      elkLogger.setContext('HTTP');
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
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
    const meta = { msg: 'HTTP Request', method, url, status, duration, requestId, timestamp: new Date().toISOString() };

    if (this.elkLogger) {
      this.elkLogger.log(JSON.stringify(meta), 'HTTP');
    } else {
      this.fallbackLogger.log(meta);
    }
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
    const meta = {
      msg: 'HTTP Request Failed',
      method,
      url,
      status,
      duration,
      requestId,
      error: sanitizeError(error),
      timestamp: new Date().toISOString(),
    };

    if (this.elkLogger) {
      this.elkLogger.error(JSON.stringify(meta), undefined, 'HTTP');
    } else {
      this.fallbackLogger.error(meta);
    }
  }
}
