import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Socket } from 'socket.io';
import { AuthenticatedUser } from './jwt.strategy';

type SocketWithUser = Socket & {
  data: Socket['data'] & {
    user?: AuthenticatedUser;
  };
};

@Injectable()
export class WsJwtGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const client = context.switchToWs().getClient<Socket>();
    const token = this.extractToken(client);

    if (!token) {
      throw new UnauthorizedException('Missing WebSocket authentication token');
    }

    return {
      ...client.handshake,
      headers: {
        ...(client.handshake.headers ?? {}),
        authorization: this.toBearerToken(token),
      },
    };
  }

  handleRequest<TUser extends AuthenticatedUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false | null,
    info: { message?: string } | undefined,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      if (err instanceof Error) {
        throw err;
      }

      throw new UnauthorizedException(
        info?.message ?? 'Invalid or missing WebSocket token',
      );
    }

    const client = context.switchToWs().getClient<SocketWithUser>();
    client.data.user = user;

    return user;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    const headerToken = client.handshake.headers?.authorization;
    const queryToken = client.handshake.query?.token;

    return (
      this.normalizeToken(authToken) ??
      this.normalizeToken(headerToken) ??
      this.normalizeToken(queryToken)
    );
  }

  private normalizeToken(token: string | string[] | undefined): string | null {
    const value = Array.isArray(token) ? token[0] : token;

    if (!value) {
      return null;
    }

    return value.replace(/^Bearer\s+/i, '').trim() || null;
  }

  private toBearerToken(token: string): string {
    return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
  }
}
