import type { AuthenticatedUser, JwtPayload } from './jwt.strategy';

export const INVALID_JWT_PAYLOAD_MESSAGE = 'Invalid JWT payload';

export function toAuthenticatedUser(payload: JwtPayload): AuthenticatedUser {
  if (
    !isNonEmptyString(payload.sub) ||
    !isNonEmptyString(payload.email) ||
    !isNonEmptyString(payload.role) ||
    !isNumericDate(payload.exp) ||
    !isOptionalNumericDate(payload.iat)
  ) {
    throw new Error(INVALID_JWT_PAYLOAD_MESSAGE);
  }

  return {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumericDate(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isOptionalNumericDate(value: unknown): boolean {
  return typeof value === 'undefined' || isNumericDate(value);
}
