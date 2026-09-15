# Quickstart: Socket.IO Handshake & Authentication Plan

## Current Contract Facts

- API Gateway access tokens are signed with `JWT_ACCESS_SECRET`.
- API Gateway access token payload contains `sub`, `email`, and `role`.
- Notification currently has Socket.IO namespace `/notifications`.
- Notification currently reads tokens from `handshake.auth.token` and `Authorization`.
- Query-string token support is not part of the contract.

## Implementation Readiness Checklist

1. Read `spec.md`, `research.md`, `data-model.md`, and `contracts/websocket-handshake.md`.
2. Confirm Notification env/config names match the API Gateway access token secret contract.
3. Plan tests before code changes:
   - valid token via `handshake.auth.token`
   - valid token via `Authorization: Bearer`
   - missing token
   - invalid token
   - expired token
   - malformed token
   - missing `sub`, `email`, or `role`
   - query-string-only token
   - authenticated user room binding
4. Implement only after tests/tasks are generated.

## Suggested Verification Commands After Implementation

```powershell
cd notification
npm test -- notification.gateway.spec.ts ws-jwt.guard.spec.ts
npm test
npm run lint
npm run build
```

If API Gateway contract tests are changed:

```powershell
cd api-gateway
npm test -- auth.service.spec.ts jwt.strategy.spec.ts
```
