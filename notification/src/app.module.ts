import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  utilities as nestWinstonModuleUtilities,
  WinstonModule,
} from 'nest-winston';
import * as winston from 'winston';
import { ElasticsearchTransport, LogData } from 'winston-elasticsearch';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { jwtConfig } from './config/jwt.config';
import { rabbitmqConfig } from './config/rabbitmq.config';
import { smtpConfig } from './config/smtp.config';
import { validationSchema } from './config/validation.schema';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { NotificationModule } from './notification/notification.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validationSchema,
      load: [appConfig, smtpConfig, rabbitmqConfig, jwtConfig],
    }),
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction =
          configService.get<string>('app.nodeEnv') === 'production';
        const elkHost = configService.get<string>('ELK_HOST');
        const appName =
          configService.get<string>('app.name') ?? 'notification-service';

        const transports: winston.transport[] = [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              winston.format.errors({ stack: true }),
              nestWinstonModuleUtilities.format.nestLike(appName, {
                prettyPrint: !isProduction,
              }),
            ),
          }),
        ];

        // Forward logs to Elasticsearch when ELK_HOST is configured.
        if (elkHost) {
          const elkTransport = new ElasticsearchTransport({
            level: configService.get<string>('ELK_LOG_LEVEL', 'info'),
            clientOpts: {
              node: elkHost,
              ...(configService.get<string>('ELK_USERNAME') && {
                auth: {
                  username: configService.get<string>('ELK_USERNAME')!,
                  password: configService.get<string>('ELK_PASSWORD', ''),
                },
              }),
            },
            indexPrefix: configService.get<string>(
              'ELK_INDEX_PREFIX',
              'talentflow-notification',
            ),
            indexSuffixPattern: 'YYYY.MM.DD',
            buffering: true,
            bufferLimit: 100,
            flushInterval: 2000,
            transformer: (logData: LogData) => ({
              '@timestamp': logData.timestamp || new Date().toISOString(),
              message: String(logData.message),
              severity: logData.level,
              fields: {
                service: appName,
                environment: configService.get<string>(
                  'app.nodeEnv',
                  'development',
                ),
                ...logData.meta,
              },
            }),
          });

          elkTransport.on('error', (error: Error) => {
            console.error(
              '[Notification] Elasticsearch transport error:',
              error,
            );
          });

          transports.push(elkTransport);
        }

        return {
          level: isProduction ? 'info' : 'debug',
          transports,
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    HealthModule,
    MetricsModule,
    NotificationModule,
    RabbitmqModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
