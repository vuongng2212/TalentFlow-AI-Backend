import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
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
    query?: {
      token?: string;
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
  const jwtAccessSecret = 'test-access-secret-change-me';

  let jwtService: JwtService;
  let gateway: NotificationGateway;
  let loggerLogSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jwtService = new JwtService({
      secret: jwtAccessSecret,
      signOptions: {
        algorithm: 'HS256',
      },
    });

    const configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'jwt.accessSecret': jwtAccessSecret,
        };

        return values[key];
      }),
    } as unknown as ConfigService;

    gateway = new NotificationGateway(jwtService, configService);
    loggerLogSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerLogSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  function createToken(
    payload: Record<string, unknown> = {
      sub: 'user-123',
      email: 'user@example.com',
      role: 'RECRUITER',
    },
    options?: Parameters<JwtService['sign']>[1],
  ): string {
    return jwtService.sign(payload, options);
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
    expect(socket.data.user).toEqual({
      userId: 'user-123',
      email: 'user@example.com',
      role: 'RECRUITER',
    });
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
    expect(error?.message).toBe(
      'Invalid or expired WebSocket authentication token',
    );
    expect(socket.data.user).toBeUndefined();
  });

  it('rejects Socket.IO handshake with an expired token', async () => {
    const middleware = getHandshakeMiddleware();
    const socket = createSocket({
      auth: {
        token: createToken(undefined, { expiresIn: -1 }),
      },
    });

    const error = await runMiddleware(middleware, socket);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe(
      'Invalid or expired WebSocket authentication token',
    );
    expect(socket.data.user).toBeUndefined();
  });

  it('rejects Socket.IO handshake with a malformed token', async () => {
    const middleware = getHandshakeMiddleware();
    const socket = createSocket({
      auth: {
        token: 'not-a-jwt',
      },
    });

    const error = await runMiddleware(middleware, socket);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe(
      'Invalid or expired WebSocket authentication token',
    );
    expect(socket.data.user).toBeUndefined();
  });

  it.each([
    ['sub', { email: 'user@example.com', role: 'RECRUITER' }],
    ['email', { sub: 'user-123', role: 'RECRUITER' }],
    ['role', { sub: 'user-123', email: 'user@example.com' }],
  ])(
    'rejects Socket.IO handshake when token is missing %s',
    async (_field, payload) => {
      const middleware = getHandshakeMiddleware();
      const socket = createSocket({
        auth: {
          token: createToken(payload),
        },
      });

      const error = await runMiddleware(middleware, socket);

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Invalid JWT payload');
      expect(socket.data.user).toBeUndefined();
    },
  );

  it('rejects query-string-only tokens during Socket.IO handshake', async () => {
    const middleware = getHandshakeMiddleware();
    const socket = createSocket({
      query: {
        token: createToken(),
      },
    });

    const error = await runMiddleware(middleware, socket);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('Missing WebSocket authentication token');
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
    expect(loggerLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket connected for user=us***@example.com'),
    );
  });

  it('disconnects the socket when connection has no authenticated user', () => {
    const socket = createSocket({});

    gateway.handleConnection(socket as never);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('logs handshake failures without raw token values', async () => {
    const middleware = getHandshakeMiddleware();
    const rawToken = 'raw-token-that-must-not-be-logged';
    const socket = createSocket({
      auth: {
        token: rawToken,
      },
    });

    await runMiddleware(middleware, socket);

    expect(loggerWarnSpy).toHaveBeenCalled();
    expect(loggerWarnSpy.mock.calls.flat().join(' ')).not.toContain(rawToken);
  });

  it('logs disconnects for authenticated and unknown users', () => {
    const authenticatedSocket = createSocket({});
    authenticatedSocket.data.user = {
      userId: 'user-123',
      email: 'user@example.com',
      role: 'RECRUITER',
    };

    gateway.handleDisconnect(authenticatedSocket as never);
    gateway.handleDisconnect(createSocket({}) as never);

    expect(loggerLogSpy).toHaveBeenCalledWith(
      'WebSocket disconnected for user=us***@example.com',
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      'WebSocket disconnected for user=unknown',
    );
  });
});
