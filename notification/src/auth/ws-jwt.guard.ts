import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DefaultEventsMap, Socket } from 'socket.io';
import { AuthenticatedUser } from './jwt.strategy';
import { extractSocketToken, toBearerToken } from './ws-token.util';

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
    const token = extractSocketToken(client);

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

  private toBearerToken(token: string): string {
    return toBearerToken(token);
  }
}
