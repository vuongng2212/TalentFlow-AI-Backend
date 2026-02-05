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
          const ms = Date.now() - started;
          const method = request.method ?? 'UNKNOWN';
          const url = request.url ?? '';
          const status = response.statusCode ?? 0;
          this.logger.log(
            `${method} ${url} ${status} +${ms}ms reqId=${requestId}`,
          );
        },
        error: (err: unknown) => {
          const ms = Date.now() - started;
          const status = response.statusCode ?? 500;
          const method = request.method ?? 'UNKNOWN';
          const url = request.url ?? '';
          const message = this.stringifyError(err);
          this.logger.error(
            `${method} ${url} ${status} +${ms}ms reqId=${requestId} err=${message}`,
          );
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

  private stringifyError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      try {
        return JSON.stringify(err);
      } catch {
        return '[unserializable error object]';
      }
    }
    return String(err);
  }
}
