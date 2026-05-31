import {
  INVALID_JWT_PAYLOAD_MESSAGE,
  toAuthenticatedUser,
} from './jwt-user.util';
import type { JwtPayload } from './jwt.strategy';

describe('jwt user mapper', () => {
  const validPayload: JwtPayload = {
    sub: 'user-123',
    email: 'user@example.com',
    role: 'RECRUITER',
    iat: 1710000000,
    exp: 1710003600,
  };

  it('maps a valid JWT payload to an authenticated user', () => {
    expect(toAuthenticatedUser(validPayload)).toEqual({
      userId: 'user-123',
      email: 'user@example.com',
      role: 'RECRUITER',
    });
  });

  it.each([
    ['sub', { ...validPayload, sub: undefined }],
    ['sub type', { ...validPayload, sub: 123 }],
    ['sub empty', { ...validPayload, sub: '   ' }],
    ['email', { ...validPayload, email: undefined }],
    ['email type', { ...validPayload, email: 123 }],
    ['email empty', { ...validPayload, email: '   ' }],
    ['role', { ...validPayload, role: undefined }],
    ['role type', { ...validPayload, role: 123 }],
    ['role empty', { ...validPayload, role: '   ' }],
    ['exp', { ...validPayload, exp: undefined }],
    ['iat', { ...validPayload, iat: 'not-a-number' }],
  ])('rejects a payload with invalid %s', (_field, payload) => {
    expect(() => toAuthenticatedUser(payload as JwtPayload)).toThrow(
      INVALID_JWT_PAYLOAD_MESSAGE,
    );
  });
});
