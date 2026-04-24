import { WsJwtGuard } from './ws-jwt.guard';

type MockSocket = {
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
};

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;

  beforeEach(() => {
    guard = new WsJwtGuard();
  });

  it('should extract the token from handshake auth first', () => {
    const client: MockSocket = {
      handshake: {
        auth: {
          token: 'Bearer auth-token',
        },
        headers: {
          authorization: 'Bearer header-token',
        },
      },
    };

    const token = (guard as unknown as { extractToken: (socket: MockSocket) => string | null }).extractToken(client);

    expect(token).toBe('auth-token');
  });

  it('should extract the token from the authorization header when auth token is missing', () => {
    const client: MockSocket = {
      handshake: {
        headers: {
          authorization: 'Bearer header-token',
        },
      },
    };

    const token = (guard as unknown as { extractToken: (socket: MockSocket) => string | null }).extractToken(client);

    expect(token).toBe('header-token');
  });

  it('should ignore query-string tokens', () => {
    const client: MockSocket = {
      handshake: {
        query: {
          token: 'query-token',
        },
      },
    };

    const token = (guard as unknown as { extractToken: (socket: MockSocket) => string | null }).extractToken(client);

    expect(token).toBeNull();
  });
});
