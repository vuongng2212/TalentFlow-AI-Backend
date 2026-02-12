import * as Joi from 'joi';

const requiredInProd = (schema: Joi.AnySchema, fallback: string) =>
  schema.when('NODE_ENV', {
    is: 'production',
    then: schema.required(),
    otherwise: schema.default(fallback),
  });

export const appConfigSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_URL: requiredInProd(
    Joi.string().uri(),
    'postgresql://localhost:5432/dev',
  ),
  REDIS_URL: requiredInProd(Joi.string().uri(), 'redis://localhost:6379'),

  JWT_ACCESS_SECRET: requiredInProd(
    Joi.string().min(16),
    'test-access-secret-change-me',
  ),
  JWT_REFRESH_SECRET: requiredInProd(
    Joi.string().min(16),
    'test-refresh-secret-change-me',
  ),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  R2_ACCOUNT_ID: Joi.string().allow('', null).default(null),
  R2_ACCESS_KEY_ID: Joi.string().allow('', null).default(null),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('', null).default(null),
  R2_BUCKET: Joi.string().allow('', null).default(null),
  R2_PUBLIC_URL: Joi.string().allow('', null).default(null),

  RATE_LIMIT_TTL_SEC: Joi.number().integer().min(1).default(60),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),

  BODY_LIMIT_MB: Joi.number().integer().min(1).default(10),
  TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),

  CORS_ORIGINS: Joi.string().allow('', null).default('http://localhost:3001'),
  SWAGGER_ENABLED: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().valid(false).default(false),
    otherwise: Joi.boolean().default(true),
  }),
});
