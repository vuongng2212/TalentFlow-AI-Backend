# Contract: Notification Socket.IO Handshake

## Namespace

- `/notifications`

## Accepted Token Locations

1. Primary:

```ts
io("http://localhost:5000/notifications", {
  auth: {
    token: accessToken,
  },
});
```

2. Fallback:

```text
Authorization: Bearer <accessToken>
```

## Rejected Token Locations

- Query string only, including:

```text
/notifications?token=<accessToken>
```

## Accepted Token Contract

- Token type: API Gateway access token
- Required identity fields:
  - `sub`
  - `email`
  - `role`
- Refresh tokens are not accepted.

## Successful Handshake Outcome

- Connection is accepted.
- Socket identity is attached as:

```ts
{
  userId: "<sub>",
  email: "<email>",
  role: "<role>"
}
```

- Socket joins the server-derived room:

```text
user:<userId>
```

## Rejected Handshake Outcomes

Reject before authenticated connection when:

- Token is missing.
- Token is invalid.
- Token is expired.
- Token is malformed.
- Token is supplied only through query string.
- Token lacks `sub`, `email`, or `role`.
- Token does not match the API Gateway access token verification contract.

## Observability Rules

- Log connection success and rejection at the Notification boundary.
- Mask PII such as email where logs include user context.
- Never log raw access tokens.
