import { sanitize, sanitizeUrl, sanitizeError } from './sanitize.util';

interface CircularNode {
  level: number;
  parent?: CircularNode;
  level2?: CircularNode;
  level3?: CircularNode;
  level4?: CircularNode;
  level5?: CircularNode;
  level6?: CircularNode;
}

describe('sanitize', () => {
  it('should redact password fields', () => {
    const input = { username: 'admin', password: 'secret123' };
    const output = sanitize(input);

    expect(output).toEqual({
      username: 'admin',
      password: '[REDACTED]',
    });
  });

  it('should redact multiple sensitive fields', () => {
    const input = {
      username: 'admin',
      password: 'secret123',
      token: 'abc123',
      apiKey: 'xyz789',
      secret: 'hidden',
    };

    const output = sanitize(input);

    expect(jest.mocked(output.password)).toBe('[REDACTED]');
    expect(jest.mocked(output.token)).toBe('[REDACTED]');
    expect(jest.mocked(output.apiKey)).toBe('[REDACTED]');
    expect(jest.mocked(output.secret)).toBe('[REDACTED]');
    expect(jest.mocked(output.username)).toBe('admin');
  });

  it('should handle nested objects', () => {
    const input = {
      user: {
        name: 'John',
        credentials: {
          token: 'abc123',
          apiKey: 'xyz789',
        },
      },
    };

    const output = sanitize(input);

    expect(jest.mocked(output.user.name)).toBe('John');
    expect(jest.mocked(output.user.credentials)).toBe('[REDACTED]'); // Whole object redacted
  });

  it('should handle arrays', () => {
    const input = [
      { id: 1, secret: 'foo' },
      { id: 2, secret: 'bar' },
    ];

    const output = sanitize(input);

    expect(output).toHaveLength(2);
    expect(jest.mocked(output[0].id)).toBe(1);
    expect(jest.mocked(output[0].secret)).toBe('[REDACTED]');
    expect(jest.mocked(output[1].id)).toBe(2);
    expect(jest.mocked(output[1].secret)).toBe('[REDACTED]');
  });

  it('should handle arrays of primitives', () => {
    const input = [1, 2, 'test', true];
    const output = sanitize(input);

    expect(output).toEqual([1, 2, 'test', true]);
  });

  it('should handle null and undefined', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize(undefined)).toBeUndefined();
    expect(sanitize({ key: null })).toEqual({ key: null });
  });

  it('should handle primitives', () => {
    expect(sanitize('test')).toBe('test');
    expect(sanitize(123)).toBe(123);
    expect(sanitize(true)).toBe(true);
  });

  it('should handle case-insensitive matching', () => {
    const input = {
      PASSWORD: 'secret',
      Token: 'abc',
      apiKey: 'xyz',
      API_KEY: 'def',
    };

    const output = sanitize(input);

    expect(jest.mocked(output.PASSWORD)).toBe('[REDACTED]');
    expect(jest.mocked(output.Token)).toBe('[REDACTED]');
    expect(jest.mocked(output.apiKey)).toBe('[REDACTED]');
    expect(jest.mocked(output.API_KEY)).toBe('[REDACTED]');
  });

  it('should prevent infinite recursion with max depth', () => {
    const circular: CircularNode = { level: 1 };
    circular.level2 = { level: 2, parent: circular };
    circular.level2.level3 = { level: 3, parent: circular };
    circular.level2.level3.level4 = { level: 4, parent: circular };
    circular.level2.level3.level4.level5 = { level: 5, parent: circular };
    circular.level2.level3.level4.level5.level6 = {
      level: 6,
      parent: circular,
    };

    const output = sanitize(circular);

    // Should stop at max depth
    expect(output).toBeDefined();
    expect(jest.mocked(output.level)).toBe(1);
  });

  it('should redact partial matches in keys', () => {
    const input = {
      userPassword: 'secret',
      access_token: 'abc',
      myApiKey: 'xyz',
    };

    const output = sanitize(input);

    expect(jest.mocked(output.userPassword)).toBe('[REDACTED]');
    expect(jest.mocked(output.access_token)).toBe('[REDACTED]');
    expect(jest.mocked(output.myApiKey)).toBe('[REDACTED]');
  });
});

describe('sanitizeUrl', () => {
  it('should redact token in query params', () => {
    const input = '/api/users?token=secret123&id=1';
    const output = sanitizeUrl(input);

    expect(output).toContain('token=[REDACTED]');
    expect(output).toContain('id=1');
  });

  it('should redact api_key in query params', () => {
    const input = '/api/data?api_key=abc123&limit=10';
    const output = sanitizeUrl(input);

    expect(output).toContain('api_key=[REDACTED]');
    expect(output).toContain('limit=10');
  });

  it('should redact multiple sensitive params', () => {
    const input = '/api/auth?token=abc&secret=xyz&id=1';
    const output = sanitizeUrl(input);

    expect(output).toContain('token=[REDACTED]');
    expect(output).toContain('secret=[REDACTED]');
    expect(output).toContain('id=1');
  });

  it('should handle URLs without query params', () => {
    const input = '/api/users';
    const output = sanitizeUrl(input);

    expect(output).toBe('/api/users');
  });

  it('should handle full URLs', () => {
    const input = 'https://api.example.com/users?token=secret';
    const output = sanitizeUrl(input);

    expect(output).toContain('token=[REDACTED]');
    expect(output).toContain('/users');
  });

  it('should handle invalid URLs gracefully', () => {
    const input = 'not-a-valid-url';
    const output = sanitizeUrl(input);

    expect(output).toBe('not-a-valid-url');
  });
});

describe('sanitizeError', () => {
  it('should sanitize Error instances', () => {
    const error = new Error(
      'Connection failed: postgres://user:pass@localhost',
    );
    const output = sanitizeError(error);

    expect(jest.mocked(output.name)).toBe('Error');
    expect(jest.mocked(output.message)).toContain(
      'postgres://user:[REDACTED]@localhost',
    );
    expect(jest.mocked(output.stack)).toBeDefined();
  });

  it('should sanitize string errors', () => {
    const error = 'Auth failed: token abc123';
    const output = sanitizeError(error);

    expect(jest.mocked(output.message)).toBeDefined();
    expect(jest.mocked(typeof output.message)).toBe('string');
  });

  it('should sanitize object errors', () => {
    const error = {
      code: 'AUTH_ERROR',
      password: 'secret',
      token: 'abc123',
    };

    const output = sanitizeError(error);

    expect(jest.mocked(output.code)).toBe('AUTH_ERROR');
    expect(jest.mocked(output.password)).toBe('[REDACTED]');
    expect(jest.mocked(output.token)).toBe('[REDACTED]');
  });

  it('should handle null/undefined errors', () => {
    expect(sanitizeError(null)).toEqual({ message: 'null' });
    expect(sanitizeError(undefined)).toEqual({ message: 'undefined' });
  });

  it('should redact Bearer tokens in error messages', () => {
    const error = new Error('Invalid token: Bearer abc123xyz789');
    const output = sanitizeError(error);

    expect(jest.mocked(output.message)).toContain('Bearer [REDACTED]');
    expect(jest.mocked(output.message)).not.toContain('abc123xyz789');
  });

  it('should redact database credentials in stack traces', () => {
    const error = new Error('DB error');
    error.stack = `Error: DB error
    at Connection (postgresql://admin:secretpass@db.example.com:5432/mydb)
    at connect (file.ts:10:5)`;

    const output = sanitizeError(error);

    expect(jest.mocked(output.stack)).toContain(
      'postgresql://admin:[REDACTED]@db.example.com',
    );
    expect(jest.mocked(output.stack)).not.toContain('secretpass');
  });
});
