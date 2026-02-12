import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  status: number;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data: T) => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse<{ statusCode: number }>();
        const status = response.statusCode;

        // Handle case where controller returns { message, ...data }
        let message = 'Success';
        let responseData = data as T | null;

        if (data && typeof data === 'object' && 'message' in data) {
          const { message: msg, ...rest } = data as {
            message: string;
            [key: string]: unknown;
          };
          message = msg;
          responseData = (
            Object.keys(rest).length > 0 ? rest : null
          ) as T | null;
        }

        return {
          status,
          message,
          data: responseData ?? (null as T),
          timestamp: new Date().toISOString(),
        } satisfies Response<T>;
      }),
    );
  }
}
