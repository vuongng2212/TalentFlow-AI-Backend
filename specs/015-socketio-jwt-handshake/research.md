# Research: Socket.IO Handshake & Authentication

## Decision 1: Validate API Gateway Access Token In Notification

- **Decision**: Notification must validate the same access token issued by API Gateway.
- **Rationale**: The spec clarification requires the existing project JWT authentication standard. API Gateway currently signs access tokens with `JWT_ACCESS_SECRET` and payload `{ sub, email, role }`; Notification must consume that contract rather than introducing a separate Notification-only token.
- **Alternatives considered**:
  - Keep Notification `JWT_SECRET` + `issuer/audience`: rejected because current API Gateway access tokens do not include this contract.
  - Add `issuer/audience` to API Gateway immediately: deferred because it expands scope into coordinated producer changes without being required by the clarified issue.
  - Create a Notification-specific token: rejected because it adds a parallel auth flow.

## Decision 2: Supported Token Transport Locations

- **Decision**: Support `handshake.auth.token` as primary and `Authorization: Bearer <token>` as fallback; reject query-string-only tokens.
- **Rationale**: `handshake.auth.token` is the preferred Socket.IO client path, `Authorization` fallback is already present in Notification runtime/tests, and query strings can leak via logs, proxies, and browser history.
- **Alternatives considered**:
  - Only `handshake.auth.token`: rejected because current runtime already supports Authorization fallback and it is useful for non-browser clients/tests.
  - Include query-string token support: rejected for security reasons.

## Decision 3: Minimum Authenticated Socket Identity

- **Decision**: Authenticated socket identity must derive from token fields `sub`, `email`, and `role`, mapped to `{ userId, email, role }` inside Notification.
- **Rationale**: API Gateway access token payload uses `sub/email/role`; Notification already models `AuthenticatedUser` as `userId/email/role`.
- **Alternatives considered**:
  - Use only `sub`: rejected because logs and authorization context currently expect email/role.
  - Require additional fields such as `fullName` or workspace membership: rejected because not present in the current access token contract.

## Decision 4: Scope Of API Gateway Work

- **Decision**: API Gateway is inspected for contract alignment but no code change is planned unless implementation discovers the token cannot be validated safely by Notification.
- **Rationale**: The user requested notification-first scope and the clarified contract says to inspect API Gateway only if needed for JWT contract alignment.
- **Alternatives considered**:
  - Modify API Gateway token issuance now: rejected as unnecessary scope expansion.
  - Ignore API Gateway completely: rejected because Notification must validate the exact token API Gateway issues.

## Decision 5: Verification Strategy

- **Decision**: Prioritize Notification unit tests for gateway middleware and WebSocket guard extraction, with optional e2e smoke coverage if needed.
- **Rationale**: The feature touches the WebSocket/auth boundary and can be verified narrowly without queue, database, email, or Prisma dependencies.
- **Alternatives considered**:
  - Full service e2e only: rejected as slower and less focused.
  - Manual-only verification: rejected because the spec requires deterministic acceptance/rejection behavior.
