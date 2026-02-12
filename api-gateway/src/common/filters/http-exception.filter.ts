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
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ||
      (response.getHeader('x-request-id') as string | string[] | undefined);

    const errorObj =
      typeof message === 'object' && message !== null ? message : { message };

    const extractedMessage = (errorObj as { message?: string | string[] })
      .message;

    const responsePayload = {
      status,
      error:
        (errorObj as { error?: string }).error || HttpStatus[status] || 'Error',
      message: Array.isArray(extractedMessage)
        ? 'Validation failed'
        : extractedMessage || message,
      details: Array.isArray(extractedMessage) ? extractedMessage : undefined,
      timestamp: new Date().toISOString(),
      requestId,
    };

    response.status(status).json(responsePayload);
  }
}
