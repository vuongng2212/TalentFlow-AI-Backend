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
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();
        const status = response.statusCode;

        // Handle case where controller returns { message, ...data }
        let message = 'Success';
        let responseData = data;

        if (data && typeof data === 'object' && 'message' in data) {
          const { message: msg, ...rest } = data;
          message = msg;
          // If only message is present, data is empty object or null?
          // Let's keep data as the rest of the object properties
          responseData = Object.keys(rest).length > 0 ? rest : null;
        }

        return {
          status,
          message,
          data: responseData,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
