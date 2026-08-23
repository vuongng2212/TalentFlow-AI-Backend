type SocketHandshakeLike = {
  auth?: unknown;
  headers?: {
    authorization?: unknown;
    cookie?: unknown;
  };
};

type SocketLike = {
  handshake: SocketHandshakeLike;
};

/**
 * Extracts a single cookie value by name from a raw `Cookie` header string.
 * Cookies are sent by the browser automatically when `withCredentials: true`
 * is set on the Socket.IO client, which is how the frontend authenticates
 * realtime connections (the access token is an HttpOnly cookie and cannot be
 * read from JS to place in `handshake.auth`).
 */
function extractCookieToken(cookieHeader: unknown, name: string): string | null {
  if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
    return null;
  }
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name && rest.length > 0) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        // Malformed percent-encoding (e.g. '%zz') — treat as no token.
        return null;
      }
    }
  }
  return null;
}

export function extractSocketToken(socket: SocketLike): string | null {
  const authToken = extractAuthToken(socket.handshake.auth);
  const headerToken = socket.handshake.headers?.authorization;
  const cookieToken = extractCookieToken(
    socket.handshake.headers?.cookie,
    'access_token',
  );

  // Priority: handshake.auth.token → Authorization header → access_token cookie.
  return (
    normalizeToken(authToken) ??
    normalizeToken(headerToken) ??
    normalizeToken(cookieToken)
  );
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
