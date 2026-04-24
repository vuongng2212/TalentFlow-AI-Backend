import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedUser } from './jwt.strategy';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should return the authenticated user when the token is valid', () => {
    const user: AuthenticatedUser = {
      userId: 'user-123',
      email: 'user@example.com',
      role: 'RECRUITER',
    };

    const result = guard.handleRequest(undefined, user);

    expect(result).toEqual(user);
  });

  it('should throw 401 when the token is invalid', () => {
    let thrownError: UnauthorizedException | undefined;

    try {
      guard.handleRequest(undefined, false, { message: 'jwt malformed' });
    } catch (error) {
      thrownError = error as UnauthorizedException;
    }

    expect(thrownError).toBeInstanceOf(UnauthorizedException);
    expect(thrownError?.getStatus()).toBe(401);
    expect(thrownError?.getResponse()).toMatchObject({
      statusCode: 401,
      message: 'jwt malformed',
      error: 'Unauthorized',
    });
  });

  it('should throw the original error when passport returns one', () => {
    const passportError = new Error('jwt expired');

    expect(() =>
      guard.handleRequest(passportError, null, { message: 'jwt expired' }),
    ).toThrow(passportError);
  });
});
