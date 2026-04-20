import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DefaultEventsMap, Socket } from 'socket.io';
import { AuthenticatedUser } from './jwt.strategy';

type SocketDataWithUser = {
  user?: AuthenticatedUser;
};

type AuthenticatedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketDataWithUser
>;

@Injectable()
export class WsJwtGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const client = this.getClient(context);
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

    const client = this.getClient(context);
    client.data.user = user;

    return user;
  }

  private getClient(context: ExecutionContext): AuthenticatedSocket {
    return context.switchToWs().getClient<AuthenticatedSocket>();
  }

  private extractToken(client: AuthenticatedSocket): string | null {
    const authToken = this.extractAuthToken(client.handshake.auth);
    const headerToken = client.handshake.headers?.authorization;
    const queryToken = client.handshake.query?.token;

    return (
      this.normalizeToken(authToken) ??
      this.normalizeToken(headerToken) ??
      this.normalizeToken(queryToken)
    );
  }

  private extractAuthToken(auth: unknown): unknown {
    if (!auth || typeof auth !== 'object') {
      return undefined;
    }

    return (auth as { token?: unknown }).token;
  }

  private normalizeToken(token: unknown): string | null {
    const value = Array.isArray(token)
      ? token.find((item): item is string => typeof item === 'string')
      : token;

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.replace(/^Bearer\s+/i, '').trim();

    if (!normalized) {
      return null;
    }

    return normalized;
  }

  private toBearerToken(token: string): string {
    return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
  }
}
