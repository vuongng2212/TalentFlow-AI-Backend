import { extractSocketToken } from './ws-token.util';

describe('extractSocketToken', () => {
  function socket(handshake: {
    auth?: unknown;
    headers?: { authorization?: unknown; cookie?: unknown };
  }) {
    return { handshake } as Parameters<typeof extractSocketToken>[0];
  }

  it('returns token from handshake.auth.token (highest priority)', () => {
    const result = extractSocketToken(
      socket({
        auth: { token: 'auth-token' },
        headers: { authorization: 'Bearer header-token', cookie: 'access_token=cookie-token' },
      }),
    );
    expect(result).toBe('auth-token');
  });

  it('falls back to Authorization header when auth.token absent', () => {
    const result = extractSocketToken(
      socket({
        auth: {},
        headers: { authorization: 'Bearer header-token', cookie: 'access_token=cookie-token' },
      }),
    );
    expect(result).toBe('header-token');
  });

  it('falls back to access_token cookie when auth/header absent', () => {
    const result = extractSocketToken(
      socket({ auth: {}, headers: { cookie: 'access_token=cookie-token' } }),
    );
    expect(result).toBe('cookie-token');
  });

  it('strips a Bearer prefix from the cookie value', () => {
    const result = extractSocketToken(
      socket({ auth: {}, headers: { cookie: 'access_token=Bearer%20cookie-token' } }),
    );
    expect(result).toBe('cookie-token');
  });

  it('decodes a URL-encoded cookie value', () => {
    const result = extractSocketToken(
      socket({ auth: {}, headers: { cookie: 'access_token=a%20b%40c' } }),
    );
    expect(result).toBe('a b@c');
  });

  it('returns null on a malformed (bad percent-encoding) cookie', () => {
    const result = extractSocketToken(
      socket({ auth: {}, headers: { cookie: 'access_token=%zz' } }),
    );
    expect(result).toBeNull();
  });

  it('returns null when no token source is present', () => {
    const result = extractSocketToken(socket({ auth: {}, headers: {} }));
    expect(result).toBeNull();
  });
});
