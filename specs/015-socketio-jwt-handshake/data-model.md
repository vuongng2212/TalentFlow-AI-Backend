# Data Model: Socket.IO Handshake & Authentication

## Entity: API Gateway Access Token

- **Purpose**: Authenticates a user attempting to establish a real-time Notification connection.
- **Owner**: API Gateway issues the token; Notification consumes it.
- **Fields required by Notification**:
  - `sub`: user identifier, mapped to Notification `userId`
  - `email`: user email, used for identity context and masked logging
  - `role`: user role, preserved for downstream authorization context
  - `exp`: expiration claim, validated by JWT verification
  - `iat`: issued-at claim, accepted as standard JWT metadata
- **Validation rules**:
  - Token must be signed with the API Gateway access token secret.
  - Token must not be expired.
  - Token must be structurally valid and decodable as JWT.
  - Token must include `sub`, `email`, and `role`.
  - Refresh tokens are not valid for this handshake.

## Entity: Authenticated Socket Identity

- **Purpose**: Normalized identity attached to an accepted Socket.IO connection.
- **Owner**: Notification service.
- **Fields**:
  - `userId`: copied from token `sub`
  - `email`: copied from token `email`
  - `role`: copied from token `role`
- **Relationships**:
  - One API Gateway access token validation creates one authenticated socket identity for one socket connection.
  - Multiple socket connections may share the same authenticated user identity.
- **Validation rules**:
  - Must only exist after successful token validation.
  - Must not be built from client-supplied room/user payloads.

## Entity: Socket Connection Session

- **Purpose**: Represents a connected real-time client in the Notification namespace.
- **Owner**: Notification service runtime memory.
- **Fields**:
  - `socketId`: Socket.IO connection identifier
  - `user`: authenticated socket identity
  - `room`: server-derived room name `user:<userId>`
- **State transitions**:
  - `pending_handshake` → `authenticated`: token validates and identity fields exist.
  - `pending_handshake` → `rejected`: token is missing, invalid, expired, malformed, query-string-only, or lacks identity fields.
  - `authenticated` → `disconnected`: client disconnects or server disconnects the socket.
- **Validation rules**:
  - Room must be derived from `user.userId`.
  - Client-provided user IDs must not choose the room.
  - Raw token must not be stored in session data or logs.
