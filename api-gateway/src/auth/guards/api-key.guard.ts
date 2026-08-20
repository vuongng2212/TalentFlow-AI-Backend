import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    const headerValue = request.headers['x-api-key'];
    const apiKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    const expectedKey = this.configService.get<string>('INGESTION_API_KEY');

    if (!apiKey || !expectedKey || apiKey !== expectedKey) {
      this.logger.warn('Invalid or missing API key in ingestion request');
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
