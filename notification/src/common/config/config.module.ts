import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfigSchema } from './config.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: appConfigSchema,
      cache: true,
      expandVariables: true,
    }),
  ],
})
export class AppConfigModule {}
