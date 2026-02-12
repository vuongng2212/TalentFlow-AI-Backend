export const JWT_ACCESS_TOKEN_EXPIRATION = '15m';
export const JWT_REFRESH_TOKEN_EXPIRATION = '7d';

export const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export const ACCESS_TOKEN_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 minutes in ms
export const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
