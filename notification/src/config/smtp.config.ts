import { registerAs } from '@nestjs/config';

export const smtpConfig = registerAs('smtp', () => ({
  host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER ?? '',
  pass: process.env.SMTP_PASS ?? '',
  from: process.env.SMTP_FROM ?? 'TalentFlow <noreply@talentflow.local>',
}));

export type SmtpConfig = ReturnType<typeof smtpConfig>;
