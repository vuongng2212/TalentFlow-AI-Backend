/**
 * Utility functions for sanitizing sensitive data in logs and responses
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/**
 * List of keys that potentially contain sensitive information
 */
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'cookie',
  'cookies',
  'credentials',
  'credential',
  'privatekey',
  'private_key',
  'accesskey',
  'access_key',
  'secretkey',
  'secret_key',
  'sessionid',
  'session_id',
  'bearer',
  'apitoken',
  'api_token',
];

/**
 * Maximum depth for recursive sanitization to prevent infinite loops
 */
const MAX_DEPTH = 5;

/**
 * Sanitize an object by replacing sensitive values with [REDACTED]
 *
 * @param obj - Object to sanitize
 * @param depth - Current recursion depth (internal use)
 * @returns Sanitized object with sensitive values redacted
 *
 * @example
 * const data = { username: 'admin', password: 'secret123' };
 * const sanitized = sanitize(data);
 * // Result: { username: 'admin', password: '[REDACTED]' }
 */
export function sanitize(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > MAX_DEPTH) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  // Handle null and undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item, depth + 1));
  }

  // Handle objects
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains any sensitive term
    const isSensitive = SENSITIVE_KEYS.some((term) => lowerKey.includes(term));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize URL by redacting sensitive query parameters
 *
 * @param url - URL string to sanitize
 * @returns Sanitized URL with sensitive params redacted
 *
 * @example
 * const url = '/api/users?token=abc123&id=1';
 * const sanitized = sanitizeUrl(url);
 * // Result: '/api/users?token=[REDACTED]&id=1'
 */
export function sanitizeUrl(url: string): string {
  // Simple path without query params
  if (!url.includes('?')) {
    return url;
  }

  try {
    // Try parsing as URL (handles both full URLs and paths with query params)
    const parsed = new URL(url, 'http://dummy.com');

    // Redact sensitive query parameters
    for (const key of SENSITIVE_KEYS) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }

    // Decode the URL to get human-readable output
    const result = decodeURIComponent(parsed.pathname + parsed.search);
    return result;
  } catch {
    // If parsing fails, return as-is
    return url;
  }
}

/**
 * Sanitize error object for safe logging
 *
 * @param error - Error object or unknown error
 * @returns Sanitized error object
 *
 * @example
 * try {
 *   throw new Error('DB connection failed: postgres://user:pass@localhost');
 * } catch (err) {
 *   const sanitized = sanitizeError(err);
 *   logger.error(sanitized);
 * }
 */
export function sanitizeError(error: unknown): any {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeString(error.message),
      stack: error.stack ? sanitizeString(error.stack) : undefined,
    };
  }

  if (typeof error === 'string') {
    return { message: sanitizeString(error) };
  }

  if (error && typeof error === 'object') {
    return sanitize(error);
  }

  return { message: String(error) };
}

/**
 * Sanitize a string by masking potential sensitive patterns
 * (e.g., connection strings, tokens in URLs)
 *
 * @param str - String to sanitize
 * @returns Sanitized string
 */
function sanitizeString(str: string): string {
  let sanitized = str;

  // Redact database connection strings
  // Example: postgresql://user:password@host:port/db
  sanitized = sanitized.replace(
    /(\w+:\/\/)([^:]+):([^@]+)@/g,
    '$1$2:[REDACTED]@',
  );

  // Redact bearer tokens
  // Example: Bearer abc123...
  sanitized = sanitized.replace(/Bearer\s+[\w-]+/gi, 'Bearer [REDACTED]');

  // Redact API keys in URLs
  // Example: ?apiKey=abc123
  sanitized = sanitized.replace(
    /([?&])(api[_-]?key|token|secret)=[^&\s]+/gi,
    '$1$2=[REDACTED]',
  );

  return sanitized;
}
