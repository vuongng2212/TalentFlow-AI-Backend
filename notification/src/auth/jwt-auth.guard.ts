import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from './jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser extends AuthenticatedUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false | null,
    info?: { message?: string },
  ): TUser {
    if (err || !user) {
      if (err instanceof Error) {
        throw err;
      }

      throw new UnauthorizedException(
        info?.message ?? 'Invalid or missing bearer token',
      );
    }

    return user;
  }
}
