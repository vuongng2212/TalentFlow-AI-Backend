import { WsJwtGuard } from './ws-jwt.guard';
import { extractSocketToken } from './ws-token.util';

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

  function createExecutionContext(client: MockSocket) {
    return {
      switchToWs: () => ({
        getClient: () => client,
      }),
    };
  }

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

    const token = extractSocketToken(client);

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

    const token = extractSocketToken(client);

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

    const token = extractSocketToken(client);

    expect(token).toBeNull();
  });

  it('should create a bearer authorization header for websocket passport auth', () => {
    const request = guard.getRequest(
      createExecutionContext({
        handshake: {
          auth: {
            token: 'auth-token',
          },
        },
      }) as never,
    ) as { headers: { authorization: string } };

    expect(request.headers.authorization).toBe('Bearer auth-token');
  });
});
