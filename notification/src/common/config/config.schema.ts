import * as Joi from 'joi';

const requiredOutsideTest = (schema: Joi.AnySchema, fallback: string) =>
  schema.when('NODE_ENV', {
    is: 'test',
    then: schema.default(fallback),
    otherwise: schema.required(),
  });

export const appConfigSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(5000),
  DATABASE_URL: Joi.string()
    .uri()
    .default('postgresql://postgres:password@localhost:5432/talentflow_notification?schema=public'),
  RABBITMQ_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri()
      .pattern(/^amqps:\/\//i)
      .required(),
    otherwise: Joi.string().uri().default('amqp://rabbitmq:rabbitmq@localhost:5672'),
  }),
  RABBITMQ_HEARTBEAT_SEC: Joi.number().integer().min(5).default(30),
  RABBITMQ_RECONNECT_INITIAL_DELAY_MS: Joi.number()
    .integer()
    .min(100)
    .default(1000),
  RABBITMQ_RECONNECT_MAX_DELAY_MS: Joi.number()
    .integer()
    .min(1000)
    .default(30000),
  JWT_ACCESS_SECRET: requiredOutsideTest(
    Joi.string().min(16),
    'test-access-secret-change-me',
  ),
  JWT_ISSUER: Joi.string().default('talentflow-api-gateway'),
  JWT_AUDIENCE: Joi.string().default('talentflow-notification'),
  RATE_LIMIT_TTL_SEC: Joi.number().integer().min(1).default(60),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  BODY_LIMIT_MB: Joi.number().integer().min(1).default(2),
  TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  CORS_ORIGINS: Joi.string().allow('', null).default('http://localhost:3001'),
  SWAGGER_ENABLED: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().valid(false).default(false),
    otherwise: Joi.boolean().default(true),
  }),
});
