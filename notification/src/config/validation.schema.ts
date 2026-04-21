import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3001),
  APP_NAME: Joi.string().default('notification-service'),
  APP_URL: Joi.string().uri().default('http://localhost:3001'),
  CORS_ORIGIN: Joi.string().allow('', null).default('http://localhost:3000'),

  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().min(16).default('test-jwt-secret-please-change'),
    otherwise: Joi.string().min(16).required(),
  }),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  JWT_ISSUER: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().default('talentflow-api-gateway'),
    otherwise: Joi.string().required(),
  }),
  JWT_AUDIENCE: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().default('talentflow-notification-service'),
    otherwise: Joi.string().required(),
  }),

  DATABASE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri().required(),
    otherwise: Joi.string()
      .uri()
      .default(
        'postgresql://postgres:postgres@localhost:5432/talentflow_notification?schema=public',
      ),
  }),

  REDIS_HOST: Joi.string().hostname().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  RABBITMQ_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri()
      .pattern(/^amqps?:\/\//i)
      .required(),
    otherwise: Joi.string().uri().default('amqp://guest:guest@localhost:5672'),
  }),
  RABBITMQ_QUEUE: Joi.string().default('notification_queue'),
  RABBITMQ_EXCHANGE: Joi.string().default('talentflow.events'),
  RABBITMQ_PREFETCH_COUNT: Joi.number().integer().min(1).default(10),

  SMTP_HOST: Joi.string().hostname().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().email().default('your-email@example.com'),
  SMTP_PASS: Joi.string().min(1).default('your-email-password'),
  SMTP_FROM: Joi.string().default('TalentFlow <noreply@talentflow.local>'),

  WS_CORS_ORIGIN: Joi.string().allow('', null).default('http://localhost:3000'),
});
