import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './common/config/config.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JobsModule } from './jobs/jobs.module';
import { ApplicationsModule } from './applications/applications.module';
import { CandidatesModule } from './candidates/candidates.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { InterviewsModule } from './interviews/interviews.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { LoggerModule } from './common/logger';
import { RequestLoggerInterceptor } from './common/interceptors/request-logger.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { WorkspaceContextGuard } from './auth/guards/workspace-context.guard';
import { WorkspaceRolesGuard } from './auth/guards/workspace-roles.guard';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (
          req: Request & {
            headers: Record<string, string | string[] | undefined>;
          },
        ) => {
          const correlationId = req.headers['x-correlation-id'];
          return Array.isArray(correlationId)
            ? String(correlationId[0])
            : typeof correlationId === 'string'
              ? correlationId
              : randomUUID();
        },
      },
    }),
    AppConfigModule,
    CommonModule,
    LoggerModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('RATE_LIMIT_TTL_SEC', 60),
            limit: config.get<number>('RATE_LIMIT_MAX', 100),
          },
        ],
      }),
    }),
    HealthModule,
    MetricsModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    JobsModule,
    ApplicationsModule,
    CandidatesModule,
    AnalyticsModule,
    InterviewsModule,
    StorageModule,
    QueueModule,
    WorkspacesModule,
    EmailTemplatesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: WorkspaceContextGuard,
    },
    {
      provide: APP_GUARD,
      useClass: WorkspaceRolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
