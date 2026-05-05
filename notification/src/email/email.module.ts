import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { EmailService } from './email.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host:
            configService.get<string>('smtp.host') ??
            process.env.SMTP_HOST ??
            'smtp.gmail.com',
          port:
            configService.get<number>('smtp.port') ??
            Number(process.env.SMTP_PORT ?? 587),
          secure:
            configService.get<boolean>('smtp.secure') ??
            process.env.SMTP_SECURE === 'true',
          auth: {
            user:
              configService.get<string>('smtp.user') ??
              process.env.SMTP_USER ??
              '',
            pass:
              configService.get<string>('smtp.pass') ??
              process.env.SMTP_PASS ??
              '',
          },
        },
        defaults: {
          from:
            configService.get<string>('smtp.from') ??
            process.env.SMTP_FROM ??
            'TalentFlow <noreply@talentflow.local>',
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
