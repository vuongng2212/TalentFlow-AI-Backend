import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  name: process.env.APP_NAME ?? 'notification-service',
  url: process.env.APP_URL ?? 'http://localhost:3001',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  wsCorsOrigin: process.env.WS_CORS_ORIGIN ?? 'http://localhost:3000',
}));

export type AppConfig = ReturnType<typeof appConfig>;
