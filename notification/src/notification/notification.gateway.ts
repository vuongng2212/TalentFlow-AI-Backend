import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthenticatedUser, JwtPayload } from '../auth/jwt.strategy';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { maskPii } from '../common/utils/pii-masker';

type SocketDataWithUser = {
  user?: AuthenticatedUser;
};

type NotificationSocket = Socket<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  SocketDataWithUser
>;

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.WS_CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server): void {
    server.use((socket: NotificationSocket, next) => {
      void this.authenticate(socket)
        .then(() => next())
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Unauthorized websocket';
          next(new Error(message));
        });
    });
  }

  handleConnection(client: NotificationSocket): void {
    const user = client.data.user;

    if (!user) {
      this.logger.warn('WebSocket client connected without authenticated user');
      client.disconnect(true);
      return;
    }

    void client.join(this.getUserRoom(user.userId));
    this.logger.log(
      `WebSocket connected for user=${maskPii(user.email)} socket=${client.id}`,
    );
  }

  handleDisconnect(client: NotificationSocket): void {
    const user = client.data.user;
    const userLabel = user ? maskPii(user.email) : 'unknown';

    this.logger.log(`WebSocket disconnected for user=${userLabel}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinUserRoom')
  joinUserRoom(@ConnectedSocket() client: NotificationSocket) {
    const user = this.requireSocketUser(client);
    const room = this.getUserRoom(user.userId);

    void client.join(room);

    return {
      event: 'joinedUserRoom',
      data: {
        room,
      },
    };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveUserRoom')
  leaveUserRoom(@ConnectedSocket() client: NotificationSocket) {
    const user = this.requireSocketUser(client);
    const room = this.getUserRoom(user.userId);

    void client.leave(room);

    return {
      event: 'leftUserRoom',
      data: {
        room,
      },
    };
  }

  sendToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(this.getUserRoom(userId)).emit(event, payload);
  }

  private async authenticate(client: NotificationSocket): Promise<void> {
    const token = this.extractToken(client);

    if (!token) {
      throw new Error('Missing WebSocket authentication token');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.configService.getOrThrow<string>('jwt.secret'),
      issuer: this.configService.getOrThrow<string>('jwt.issuer'),
      audience: this.configService.getOrThrow<string>('jwt.audience'),
      algorithms: ['HS256'],
    });

    client.data.user = this.toAuthenticatedUser(payload);
  }

  private toAuthenticatedUser(payload: JwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.email || !payload.role) {
      throw new Error('Invalid JWT payload');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }

  private requireSocketUser(client: NotificationSocket): AuthenticatedUser {
    const user = client.data.user;

    if (!user) {
      throw new Error('WebSocket user is not authenticated');
    }

    return user;
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  private extractToken(client: NotificationSocket): string | null {
    const authToken = this.extractAuthToken(client.handshake.auth);
    const headerToken = client.handshake.headers?.authorization;

    return this.normalizeToken(authToken) ?? this.normalizeToken(headerToken);
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
}
