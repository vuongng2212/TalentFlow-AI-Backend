import { appConfigSchema } from './config.schema';

describe('appConfigSchema', () => {
  it('should require JWT secrets outside test environment', () => {
    const { error } = appConfigSchema.validate(
      {
        NODE_ENV: 'development',
      },
      { abortEarly: false },
    );

    expect(error).toBeDefined();

    const paths = (error?.details ?? []).map((detail) => detail.path.join('.'));

    expect(paths).toContain('JWT_ACCESS_SECRET');
    expect(paths).toContain('JWT_REFRESH_SECRET');
  });

  it('should allow test environment with fallback JWT secrets', () => {
    const { error, value } = appConfigSchema.validate({
      NODE_ENV: 'test',
    }) as {
      error: unknown;
      value: { JWT_ACCESS_SECRET: string; JWT_REFRESH_SECRET: string };
    };

    expect(error).toBeUndefined();
    expect(jest.mocked(value.JWT_ACCESS_SECRET)).toBe(
      'test-access-secret-change-me',
    );
    expect(jest.mocked(value.JWT_REFRESH_SECRET)).toBe(
      'test-refresh-secret-change-me',
    );
  });

  it('should pass in development when JWT secrets are provided', () => {
    const { error } = appConfigSchema.validate({
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: 'development-access-secret-123',
      JWT_REFRESH_SECRET: 'development-refresh-secret-123',
      INGESTION_API_KEY: 'development-ingestion-key-123',
      MOMO_API_BASE_URL: 'https://test-payment.momo.vn',
      MOMO_PARTNER_CODE: 'development-partner',
      MOMO_ACCESS_KEY: 'development-access-key',
      MOMO_SECRET_KEY: 'development-momo-secret-key',
      MOMO_IPN_URL: 'https://payments.example.test/api/v1/payments/momo/ipn',
      MOMO_REDIRECT_URL: 'http://localhost:3001/payment/return',
      PAYMENT_CATALOG_JSON:
        '[{"code":"DEMO_SERVICE","description":"Demo service","amountVnd":10000,"taxVnd":0,"termsVersion":"test","enabled":true}]',
      PAYMENT_INVOICE_BUCKET: 'payment-invoices-development',
      PAYMENT_RECEIPT_ISSUER_NAME: 'TalentFlow AI',
      PAYMENT_RECEIPT_ISSUER_ADDRESS: 'Development',
    });

    expect(error).toBeUndefined();
  });

  it('rejects malformed or client-like payment catalogue values', () => {
    const { error } = appConfigSchema.validate({
      NODE_ENV: 'test',
      PAYMENT_CATALOG_JSON:
        '[{"code":"bad code","description":"Demo","amountVnd":99,"taxVnd":0,"termsVersion":"v1"}]',
    });

    expect(error).toBeDefined();
  });

  it('should include default RabbitMQ resilience values', () => {
    const { error, value } = appConfigSchema.validate({
      NODE_ENV: 'test',
    }) as {
      error: unknown;
      value: {
        RABBITMQ_HEARTBEAT_SEC: number;
        RABBITMQ_RECONNECT_INITIAL_DELAY_MS: number;
        RABBITMQ_RECONNECT_MAX_DELAY_MS: number;
      };
    };

    expect(error).toBeUndefined();
    expect(jest.mocked(value.RABBITMQ_HEARTBEAT_SEC)).toBe(30);
    expect(jest.mocked(value.RABBITMQ_RECONNECT_INITIAL_DELAY_MS)).toBe(1000);
    expect(jest.mocked(value.RABBITMQ_RECONNECT_MAX_DELAY_MS)).toBe(30000);
  });

  it('should require amqps protocol for RabbitMQ in production', () => {
    const { error } = appConfigSchema.validate(
      {
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgresql://postgres:postgres@localhost:5432/talentflow_dev',
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: 'amqp://localhost:5672',
        JWT_ACCESS_SECRET: 'development-access-secret-123',
        JWT_REFRESH_SECRET: 'development-refresh-secret-123',
      },
      { abortEarly: false },
    );

    expect(error).toBeDefined();

    const paths = (error?.details ?? []).map((detail) => detail.path.join('.'));
    expect(paths).toContain('RABBITMQ_URL');
  });
});
