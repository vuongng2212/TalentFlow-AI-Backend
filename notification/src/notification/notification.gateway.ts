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
import { Logger, Optional, UseGuards } from '@nestjs/common';
import { Namespace, Server, Socket } from 'socket.io';
import { AuthenticatedUser, JwtPayload } from '../auth/jwt.strategy';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import {
  INVALID_JWT_PAYLOAD_MESSAGE,
  toAuthenticatedUser,
} from '../auth/jwt-user.util';
import { extractSocketToken } from '../auth/ws-token.util';
import { maskPii } from '../common/utils/pii-masker';
import { MetricsService } from '../metrics/metrics.service';


type SocketDataWithUser = {
  user?: AuthenticatedUser;
};

type NotificationSocket = Socket<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  SocketDataWithUser
>;

type SocketIoServerOrNamespace = Server | Namespace;

@WebSocketGateway({
  namespace: '/notifications',
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
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  afterInit(server: SocketIoServerOrNamespace): void {
    this.configureCors(server);

    server.use((socket: NotificationSocket, next) => {
      void this.authenticate(socket)
        .then(() => next())
        .catch((error: unknown) => {
          const message = this.toHandshakeErrorMessage(error);
          const cause = this.toLoggableErrorMessage(error);

          this.logger.warn(
            `WebSocket authentication failed: ${message}; cause=${cause}`,
          );
          next(new Error(message));
        });
    });
  }

  async handleConnection(client: NotificationSocket): Promise<void> {
    const user = client.data.user;

    if (!user) {
      this.logger.warn('WebSocket client connected without authenticated user');
      client.disconnect(true);
      return;
    }

    try {
      await client.join(this.getUserRoom(user.userId));
    } catch (error) {
      this.logger.warn(
        `Failed to join authenticated user room for user=${maskPii(
          user.email,
        )}: ${this.toLoggableErrorMessage(error)}`,
      );
      client.disconnect(true);
      return;
    }

    this.logger.log(
      `WebSocket connected for user=${maskPii(user.email)} socket=${client.id}`,
    );
    this.metricsService?.wsClientConnected();
  }

  handleDisconnect(client: NotificationSocket): void {
    const user = client.data.user;
    const userLabel = user ? maskPii(user.email) : 'unknown';

    this.logger.log(`WebSocket disconnected for user=${userLabel}`);
    this.metricsService?.wsClientDisconnected();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinUserRoom')
  async joinUserRoom(@ConnectedSocket() client: NotificationSocket) {
    const user = this.requireSocketUser(client);
    const room = this.getUserRoom(user.userId);

    await client.join(room);

    return {
      event: 'joinedUserRoom',
      data: {
        room,
      },
    };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveUserRoom')
  async leaveUserRoom(@ConnectedSocket() client: NotificationSocket) {
    const user = this.requireSocketUser(client);
    const room = this.getUserRoom(user.userId);

    await client.leave(room);

    return {
      event: 'leftUserRoom',
      data: {
        room,
      },
    };
  }

  sendToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(this.getUserRoom(userId)).emit(event, payload);
    this.metricsService?.recordNotificationSent('websocket', 'success');
  }

  private async authenticate(client: NotificationSocket): Promise<void> {
    const token = extractSocketToken(client);

    if (!token) {
      throw new Error('Missing WebSocket authentication token');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
      algorithms: ['HS256'],
    });

    client.data.user = toAuthenticatedUser(payload);
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

  private configureCors(server: SocketIoServerOrNamespace): void {
    const socketServer = 'engine' in server ? server : server.server;
    const existingCors = socketServer.engine.opts.cors;
    const existingCorsOptions =
      existingCors && typeof existingCors === 'object' ? existingCors : {};

    socketServer.engine.opts.cors = {
      ...existingCorsOptions,
      origin:
        this.configService.get<string>('app.wsCorsOrigin') ??
        'http://localhost:3000',
      credentials: true,
    };
  }

  private toHandshakeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (
        error.message === 'Missing WebSocket authentication token' ||
        error.message === INVALID_JWT_PAYLOAD_MESSAGE
      ) {
        return error.message;
      }
    }

    return 'Invalid or expired WebSocket authentication token';
  }

  private toLoggableErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
