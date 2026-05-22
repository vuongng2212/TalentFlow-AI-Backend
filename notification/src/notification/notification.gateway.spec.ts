import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { NotificationGateway } from './notification.gateway';

type MockNotificationSocket = {
  id: string;
  handshake: {
    auth?: {
      token?: string;
    };
    headers?: {
      authorization?: string;
    };
  };
  data: {
    user?: AuthenticatedUser;
  };
  join: jest.Mock;
  leave: jest.Mock;
  disconnect: jest.Mock;
};

type SocketMiddleware = (
  socket: MockNotificationSocket,
  next: (error?: Error) => void,
) => void;

describe('NotificationGateway', () => {
  const jwtSecret = 'test-jwt-secret-please-change';
  const jwtIssuer = 'talentflow-api-gateway';
  const jwtAudience = 'talentflow-notification-service';

  let jwtService: JwtService;
  let gateway: NotificationGateway;

  beforeEach(() => {
    jwtService = new JwtService({
      secret: jwtSecret,
      signOptions: {
        algorithm: 'HS256',
        issuer: jwtIssuer,
        audience: jwtAudience,
      },
    });

    const configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'jwt.secret': jwtSecret,
          'jwt.issuer': jwtIssuer,
          'jwt.audience': jwtAudience,
        };

        return values[key];
      }),
    } as unknown as ConfigService;

    gateway = new NotificationGateway(jwtService, configService);
  });

  function createToken(): string {
    return jwtService.sign({
      sub: 'user-123',
      email: 'user@example.com',
      role: 'RECRUITER',
    });
  }

  function createSocket(
    handshake: MockNotificationSocket['handshake'],
  ): MockNotificationSocket {
    return {
      id: 'socket-1',
      handshake,
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
    };
  }

  function getHandshakeMiddleware(): SocketMiddleware {
    let middleware: SocketMiddleware | undefined;
    const server = {
      use: jest.fn((nextMiddleware: SocketMiddleware) => {
        middleware = nextMiddleware;
      }),
    };

    gateway.afterInit(server as unknown as Server);

    if (!middleware) {
      throw new Error('Socket.IO middleware was not registered');
    }

    return middleware;
  }

  async function runMiddleware(
    middleware: SocketMiddleware,
    socket: MockNotificationSocket,
  ): Promise<Error | undefined> {
    return new Promise((resolve) => {
      middleware(socket, (error?: Error) => resolve(error));
    });
  }

  it('authenticates Socket.IO handshake token from auth.token', async () => {
    const middleware = getHandshakeMiddleware();
    const socket = createSocket({
      auth: {
        token: createToken(),
      },
    });

    const error = await runMiddleware(middleware, socket);

    expect(error).toBeUndefined();
    expect(socket.data.user).toEqual({
      userId: 'user-123',
      email: 'user@example.com',
      role: 'RECRUITER',
    });
  });

  it('authenticates Socket.IO handshake token from Authorization header', async () => {
    const middleware = getHandshakeMiddleware();
    const socket = createSocket({
      headers: {
        authorization: `Bearer ${createToken()}`,
      },
    });

    const error = await runMiddleware(middleware, socket);

    expect(error).toBeUndefined();
    expect(socket.data.user?.userId).toBe('user-123');
  });

  it('rejects Socket.IO handshake without a token', async () => {
    const middleware = getHandshakeMiddleware();
    const socket = createSocket({});

    const error = await runMiddleware(middleware, socket);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('Missing WebSocket authentication token');
    expect(socket.data.user).toBeUndefined();
  });

  it('rejects Socket.IO handshake with an invalid token', async () => {
    const middleware = getHandshakeMiddleware();
    const socket = createSocket({
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    const error = await runMiddleware(middleware, socket);

    expect(error).toBeInstanceOf(Error);
    expect(socket.data.user).toBeUndefined();
  });

  it('joins the authenticated user room when connection is established', () => {
    const socket = createSocket({});

    socket.data.user = {
      userId: 'user-123',
      email: 'user@example.com',
      role: 'RECRUITER',
    };

    gateway.handleConnection(socket as never);

    expect(socket.join).toHaveBeenCalledWith('user:user-123');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects the socket when connection has no authenticated user', () => {
    const socket = createSocket({});

    gateway.handleConnection(socket as never);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });
});
