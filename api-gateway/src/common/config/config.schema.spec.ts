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
    });

    expect(error).toBeUndefined();
    expect(value.JWT_ACCESS_SECRET).toBe('test-access-secret-change-me');
    expect(value.JWT_REFRESH_SECRET).toBe('test-refresh-secret-change-me');
  });

  it('should pass in development when JWT secrets are provided', () => {
    const { error } = appConfigSchema.validate({
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: 'development-access-secret-123',
      JWT_REFRESH_SECRET: 'development-refresh-secret-123',
    });

    expect(error).toBeUndefined();
  });
});
