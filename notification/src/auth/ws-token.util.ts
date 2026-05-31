type SocketHandshakeLike = {
  auth?: unknown;
  headers?: {
    authorization?: unknown;
  };
};

type SocketLike = {
  handshake: SocketHandshakeLike;
};

export function extractSocketToken(socket: SocketLike): string | null {
  const authToken = extractAuthToken(socket.handshake.auth);
  const headerToken = socket.handshake.headers?.authorization;

  return normalizeToken(authToken) ?? normalizeToken(headerToken);
}

function extractAuthToken(auth: unknown): unknown {
  if (!auth || typeof auth !== 'object') {
    return undefined;
  }

  return (auth as { token?: unknown }).token;
}

function normalizeToken(token: unknown): string | null {
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

export function toBearerToken(token: string): string {
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
}
