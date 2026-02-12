import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import hpp from 'hpp';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { RequestLoggerInterceptor } from './common/interceptors/request-logger.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const logger = new Logger('Bootstrap');
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const bodyLimitMb = configService.get<number>('BODY_LIMIT_MB', 10);
  const corsOriginsRaw = configService.get<string>('CORS_ORIGINS') || '';
  const corsOrigins = corsOriginsRaw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'metrics'] });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(hpp());
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : [/^http:\/\/localhost:\d+$/],
    credentials: true,
  });

  app.use(json({ limit: `${bodyLimitMb}mb` }));
  app.use(urlencoded({ extended: true, limit: `${bodyLimitMb}mb` }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
    }),
  );

  app.useGlobalInterceptors(
    new RequestLoggerInterceptor(),
    new TransformInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port);
  logger.log(`API Gateway listening on port ${port}`);
}

void bootstrap();
