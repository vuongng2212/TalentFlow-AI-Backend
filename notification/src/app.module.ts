import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  utilities as nestWinstonModuleUtilities,
  WinstonModule,
} from 'nest-winston';
import * as winston from 'winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { jwtConfig } from './config/jwt.config';
import { rabbitmqConfig } from './config/rabbitmq.config';
import { smtpConfig } from './config/smtp.config';
import { validationSchema } from './config/validation.schema';
import { HealthModule } from './health/health.module';
import { NotificationModule } from './notification/notification.module';

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
      useFactory: (configService: ConfigService) => ({
        level:
          configService.get<string>('app.nodeEnv') === 'production'
            ? 'info'
            : 'debug',
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              winston.format.errors({ stack: true }),
              nestWinstonModuleUtilities.format.nestLike(
                configService.get<string>('app.name') ?? 'NotificationService',
                {
                  prettyPrint: true,
                },
              ),
            ),
          }),
        ],
      }),
    }),
    HealthModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
