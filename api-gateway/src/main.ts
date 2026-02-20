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
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ElkLoggerService } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const elkHost = configService.get<string>('ELK_HOST');

  if (elkHost) {
    const elkLogger = await app.resolve(ElkLoggerService);
    elkLogger.setContext('Bootstrap');
    app.useLogger(elkLogger);
  } else {
    const logger = new Logger('Bootstrap');
    app.useLogger(logger);
  }

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

  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED', true);
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TalentFlow AI API')
      .setDescription('API documentation for the TalentFlow AI API Gateway')
      .setVersion('v1')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your access token',
        },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('/api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    const httpAdapter = app.getHttpAdapter();
    const expressInstance =
      typeof httpAdapter.getInstance === 'function'
        ? httpAdapter.getInstance()
        : null;

    if (expressInstance && typeof expressInstance.get === 'function') {
      expressInstance.get(
        '/api-json',
        (
          _req: unknown,
          res: { type: (type: string) => { send: (body: unknown) => void } },
        ) => {
          res.type('application/json').send(document);
        },
      );
    }
  }

  await app.listen(port);

  const bootstrapLogger = elkHost
    ? await app.resolve(ElkLoggerService)
    : new Logger('Bootstrap');
  bootstrapLogger.log(`API Gateway listening on port ${port}`);
}

void bootstrap();
