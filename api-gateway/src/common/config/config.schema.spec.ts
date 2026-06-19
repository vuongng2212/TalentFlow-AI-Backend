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
    expect(value.JWT_ACCESS_SECRET).toBe('test-access-secret-change-me');
    expect(value.JWT_REFRESH_SECRET).toBe('test-refresh-secret-change-me');
  });

  it('should pass in development when JWT secrets are provided', () => {
    const { error } = appConfigSchema.validate({
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: 'development-access-secret-123',
      JWT_REFRESH_SECRET: 'development-refresh-secret-123',
      MOMO_PARTNER_CODE: 'partner',
      MOMO_ACCESS_KEY: 'access',
      MOMO_SECRET_KEY: 'secret',
      MOMO_ENDPOINT_BASE_URL: 'https://test-payment.momo.vn',
      MOMO_REDIRECT_URL: 'http://localhost:3000/momo/redirect',
      MOMO_IPN_URL: 'http://localhost:3000/momo/ipn',
    });

    expect(error).toBeUndefined();
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
    expect(value.RABBITMQ_HEARTBEAT_SEC).toBe(30);
    expect(value.RABBITMQ_RECONNECT_INITIAL_DELAY_MS).toBe(1000);
    expect(value.RABBITMQ_RECONNECT_MAX_DELAY_MS).toBe(30000);
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
        MOMO_PARTNER_CODE: 'partner',
        MOMO_ACCESS_KEY: 'access',
        MOMO_SECRET_KEY: 'secret',
        MOMO_ENDPOINT_BASE_URL: 'https://test-payment.momo.vn',
        MOMO_REDIRECT_URL: 'https://app.test/momo/redirect',
        MOMO_IPN_URL: 'https://app.test/momo/ipn',
      },
      { abortEarly: false },
    );

    expect(error).toBeDefined();

    const paths = (error?.details ?? []).map((detail) => detail.path.join('.'));
    expect(paths).toContain('RABBITMQ_URL');
  });

  it('should include test defaults for MoMo billing and mock Business workspace id', () => {
    const { error, value } = appConfigSchema.validate({
      NODE_ENV: 'test',
    }) as {
      error: unknown;
      value: {
        MOMO_PARTNER_CODE: string;
        MOMO_ACCESS_KEY: string;
        MOMO_SECRET_KEY: string;
        MOMO_ENDPOINT_BASE_URL: string;
        MOMO_REQUEST_TYPE: string;
        MOMO_LANGUAGE: string;
        SUBSCRIPTION_BUSINESS_WORKSPACE_ID: string;
      };
    };

    expect(error).toBeUndefined();
    expect(value.MOMO_PARTNER_CODE).toBe('MOMO_TEST_PARTNER');
    expect(value.MOMO_ACCESS_KEY).toBe('test-access-key');
    expect(value.MOMO_SECRET_KEY).toBe('test-secret-key');
    expect(value.MOMO_ENDPOINT_BASE_URL).toBe('https://test-payment.momo.vn');
    expect(value.MOMO_REQUEST_TYPE).toBe('captureWallet');
    expect(value.MOMO_LANGUAGE).toBe('en');
    expect(value.SUBSCRIPTION_BUSINESS_WORKSPACE_ID).toBe(
      'mock-business-workspace',
    );
  });

  it('should require MoMo billing config outside test', () => {
    const { error } = appConfigSchema.validate(
      {
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'development-access-secret-123',
        JWT_REFRESH_SECRET: 'development-refresh-secret-123',
      },
      { abortEarly: false },
    );

    const paths = (error?.details ?? []).map((detail) => detail.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining([
        'MOMO_PARTNER_CODE',
        'MOMO_ACCESS_KEY',
        'MOMO_SECRET_KEY',
        'MOMO_ENDPOINT_BASE_URL',
        'MOMO_REDIRECT_URL',
        'MOMO_IPN_URL',
      ]),
    );
  });
});
