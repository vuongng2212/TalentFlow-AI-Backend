import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sanitize } from '../utils/sanitize.util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: unknown;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'object'
          ? sanitize(exceptionResponse)
          : exceptionResponse;
    } else {
      // In production, don't expose internal error details
      message =
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : sanitize({
              error:
                exception instanceof Error
                  ? exception.message
                  : String(exception),
            });
    }

    // Try to get requestId from request first (set by interceptor), then response header
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const requestId =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (request as any)['x-request-id'] ||
      request.headers['x-request-id'] ||
      response.getHeader('x-request-id') ||
      undefined;

    const errorObj = typeof message === 'object' && message !== null ? message : { message };
    const errorMessage = (errorObj as any).message;
    const errorName = (errorObj as any).error || HttpStatus[status];

    response.status(status).json({
      status,
      error: errorName,
      message: Array.isArray(errorMessage) ? 'Validation failed' : errorMessage || message,
      details: Array.isArray(errorMessage) ? errorMessage : undefined,
      timestamp: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      requestId,
    });
  }
}
