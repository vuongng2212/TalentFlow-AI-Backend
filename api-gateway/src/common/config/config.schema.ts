import * as Joi from 'joi';

const requiredInProd = (schema: Joi.AnySchema, fallback: string) =>
  schema.when('NODE_ENV', {
    is: 'production',
    then: schema.required(),
    otherwise: schema.default(fallback),
  });

const requiredOutsideTest = (schema: Joi.AnySchema, fallback: string) =>
  schema.when('NODE_ENV', {
    is: 'test',
    then: schema.default(fallback),
    otherwise: schema.required(),
  });

const paymentCatalogueSchema = Joi.string()
  .custom((value: string, helpers) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      return helpers.error('any.invalid');
    }

    if (!Array.isArray(parsed)) {
      return helpers.error('any.invalid');
    }

    const seenCodes = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        return helpers.error('any.invalid');
      }
      const quote = item as Record<string, unknown>;
      const code = quote.code;
      const description = quote.description;
      const amountVnd = quote.amountVnd;
      const taxVnd = quote.taxVnd;
      const termsVersion = quote.termsVersion;

      if (
        typeof code !== 'string' ||
        !/^[A-Z0-9][A-Z0-9_.-]*$/.test(code) ||
        seenCodes.has(code) ||
        typeof description !== 'string' ||
        description.length === 0 ||
        typeof termsVersion !== 'string' ||
        termsVersion.length === 0 ||
        !Number.isInteger(amountVnd) ||
        !Number.isInteger(taxVnd) ||
        typeof amountVnd !== 'number' ||
        typeof taxVnd !== 'number' ||
        amountVnd < 0 ||
        taxVnd < 0 ||
        amountVnd + taxVnd < 1000 ||
        amountVnd + taxVnd > 50_000_000 ||
        (quote.enabled !== undefined && typeof quote.enabled !== 'boolean')
      ) {
        return helpers.error('any.invalid');
      }
      seenCodes.add(code);
    }

    return value;
  })
  .messages({
    'any.invalid':
      'PAYMENT_CATALOG_JSON must be a unique, enabled-only server quote catalogue using whole-number VND totals between 1,000 and 50,000,000',
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
  RABBITMQ_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri()
      .pattern(/^amqps:\/\//i)
      .required(),
    otherwise: Joi.string()
      .uri()
      .default('amqp://rabbitmq:rabbitmq@localhost:5672'),
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
  JWT_REFRESH_SECRET: requiredOutsideTest(
    Joi.string().min(16),
    'test-refresh-secret-change-me',
  ),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  R2_ENDPOINT: Joi.string().uri().allow('', null).default(null),
  R2_ACCOUNT_ID: Joi.string().allow('', null).default(null),
  R2_ACCESS_KEY_ID: Joi.string().allow('', null).default(null),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('', null).default(null),
  R2_BUCKET: Joi.string().default('talentflow-cvs'),
  R2_PUBLIC_URL: Joi.string().uri().allow('', null).default(null),

  // MoMo payment and private receipt storage. Credentials intentionally have
  // no non-test default so a development or production process cannot begin a
  // financial flow with a guessable merchant identity.
  MOMO_API_BASE_URL: requiredOutsideTest(
    Joi.string().uri({ scheme: ['https'] }),
    'https://test-payment.momo.vn',
  ),
  MOMO_PARTNER_CODE: requiredOutsideTest(
    Joi.string().trim().min(1).max(50),
    'test-partner-code',
  ),
  MOMO_ACCESS_KEY: requiredOutsideTest(
    Joi.string().trim().min(1).max(100),
    'test-access-key',
  ),
  MOMO_SECRET_KEY: requiredOutsideTest(
    Joi.string().trim().min(16).max(255),
    'test-momo-secret-key-change-me',
  ),
  MOMO_IPN_URL: requiredOutsideTest(
    Joi.string().uri(),
    'https://payments.test.local/api/v1/payments/momo/ipn',
  ),
  MOMO_REDIRECT_URL: requiredOutsideTest(
    Joi.string().uri(),
    'http://localhost:3001/payment/return',
  ),
  MOMO_REQUEST_TIMEOUT_MS: Joi.number().integer().min(30000).default(30000),
  PAYMENT_CATALOG_JSON: requiredOutsideTest(paymentCatalogueSchema, '[]'),
  PAYMENT_RECOVERY_INTERVAL_SECONDS: Joi.number()
    .integer()
    .min(5)
    .max(3600)
    .default(30),
  PAYMENT_RECOVERY_LEASE_SECONDS: Joi.number()
    .integer()
    .min(15)
    .max(3600)
    .default(60),
  PAYMENT_RECOVERY_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10),
  PAYMENT_INVOICE_BUCKET: requiredOutsideTest(
    Joi.string().trim().min(3).max(255),
    'talentflow-payment-invoices-test',
  ),
  PAYMENT_INVOICE_URL_TTL_SEC: Joi.number()
    .integer()
    .min(60)
    .max(3600)
    .default(300),
  PAYMENT_RECEIPT_ISSUER_NAME: requiredOutsideTest(
    Joi.string().trim().min(1).max(255),
    'TalentFlow AI Test Issuer',
  ),
  PAYMENT_RECEIPT_ISSUER_ADDRESS: requiredOutsideTest(
    Joi.string().trim().min(1).max(500),
    'Test environment',
  ),

  RATE_LIMIT_TTL_SEC: Joi.number().integer().min(1).default(60),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  WORKSPACE_MAX_ACTIVE_MEMBERS: Joi.number().integer().min(1).default(50),

  BODY_LIMIT_MB: Joi.number().integer().min(1).default(10),
  TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),

  CORS_ORIGINS: Joi.string().allow('', null).default('http://localhost:3001'),
  SWAGGER_ENABLED: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().valid(false).default(false),
    otherwise: Joi.boolean().default(true),
  }),

  // n8n Email Ingestion
  // Required in production: the ingestion endpoint is @Public() and protected
  // only by this key, so a hardcoded default would leave a guessable key enabled.
  INGESTION_API_KEY: requiredOutsideTest(
    Joi.string().min(16),
    'dev-ingestion-api-key-change-me',
  ),

  // Workspace Multi-Tenancy
  WORKSPACE_INVITATION_EXPIRY_DAYS: Joi.number()
    .integer()
    .min(1)
    .max(90)
    .default(7),
  WORKSPACE_INVITE_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:3001/invite/accept'),
});
