import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import hpp from 'hpp';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
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

  const port = configService.get<number>('PORT', 8080);
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

  // Disable gzip for upload routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.includes('/upload')) {
      res.setHeader('Cache-Control', 'no-transform');
    }
    next();
  });

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

    // Save Swagger spec to file if GENERATE_SWAGGER env var is true
    if (process.env.GENERATE_SWAGGER === 'true') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      fs.writeFileSync(
        './swagger-spec.json',
        JSON.stringify(document, null, 2),
      );
      const logger = new Logger('Swagger');
      logger.log('Swagger spec generated at ./swagger-spec.json');

      // If we only want to generate the swagger spec and exit (e.g. CI/CD)
      if (process.env.EXIT_AFTER_GENERATE === 'true') {
        process.exit(0);
      }
    }

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
