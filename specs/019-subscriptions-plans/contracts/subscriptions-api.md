# HTTP Contract: Subscriptions and Plan Entitlements

**Base URL**: `/api/v1`  
**Authentication**: existing access-token authentication  
**Response envelope**: the global transform interceptor wraps successful values as `{ status, message, data, timestamp }`.

## Context Rules

- `GET /subscriptions/plans` is authenticated but catalogue-global. It uses `@SkipWorkspaceContext()` and does not require `x-workspace-id`.
- `GET /subscriptions/current` and `PUT /subscriptions/current` operate on the workspace resolved by the existing `WorkspaceContextGuard`:
  1. active membership for the supplied `x-workspace-id`, otherwise
  2. the caller's active workspace, otherwise
  3. the caller's first active membership.
- The change operation requires an ACTIVE workspace membership with role OWNER or ADMIN. Viewers, recruiters, inactive members, and nonmembers cannot select a plan.
- There is intentionally no `:workspaceId` path parameter. This keeps the resource ID identical to the workspace ID already authorized by the global context/roles guards.

## Shared Schemas

### Plan

```json
{
  "code": "FREE",
  "name": "Free",
  "displayOrder": 1,
  "isActive": true,
  "enablesBusiness": false
}
```

| Field             | Type                       | Notes                                   |
| ----------------- | -------------------------- | --------------------------------------- |
| `code`            | `FREE \| PLUS \| BUSINESS` | Stable selection identity               |
| `name`            | string                     | Free, Plus, Business                    |
| `displayOrder`    | integer                    | 1, 2, 3                                 |
| `isActive`        | boolean                    | An inactive plan remains non-selectable |
| `enablesBusiness` | boolean                    | True only for Business                  |

### Current subscription

```json
{
  "id": "c5325c97-8a3f-4ab3-bc42-a5ebae5a629d",
  "workspaceId": "1e1cb03a-61d6-4693-9446-326390da4a0b",
  "status": "ACTIVE",
  "startedAt": "2026-09-16T08:00:00.000Z",
  "updatedAt": "2026-09-16T08:00:00.000Z",
  "isBusiness": false,
  "plan": {
    "code": "FREE",
    "name": "Free",
    "displayOrder": 1,
    "isActive": true,
    "enablesBusiness": false
  }
}
```

`isBusiness` is a read-only compatibility projection of `plan.enablesBusiness`. It is never an accepted request field.

## Endpoints

### List plan catalogue

```http
GET /api/v1/subscriptions/plans
Authorization: Bearer <access token>
```

Success (200):

```json
{
  "status": 200,
  "message": "Success",
  "data": [
    {
      "code": "FREE",
      "name": "Free",
      "displayOrder": 1,
      "isActive": true,
      "enablesBusiness": false
    },
    {
      "code": "PLUS",
      "name": "Plus",
      "displayOrder": 2,
      "isActive": true,
      "enablesBusiness": false
    },
    {
      "code": "BUSINESS",
      "name": "Business",
      "displayOrder": 3,
      "isActive": true,
      "enablesBusiness": true
    }
  ],
  "timestamp": "2026-09-16T08:00:00.000Z"
}
```

The initial response always contains exactly these three plans in ascending `displayOrder`.

### Read current workspace subscription

```http
GET /api/v1/subscriptions/current
Authorization: Bearer <access token>
x-workspace-id: <optional active workspace UUID>
```

Success (200): response envelope with the Current subscription schema.

Errors:

| Status | Condition                                                                             |
| ------ | ------------------------------------------------------------------------------------- |
| 401    | No valid authenticated session/token                                                  |
| 400    | The caller has no resolvable accessible workspace                                     |
| 403    | Supplied workspace context is not an active membership                                |
| 404    | Data-integrity failure: a resolved workspace has no migrated/provisioned subscription |

### Select the current workspace plan

```http
PUT /api/v1/subscriptions/current
Authorization: Bearer <access token>
x-workspace-id: <optional active workspace UUID>
Content-Type: application/json

{
  "planCode": "BUSINESS"
}
```

Request schema:

| Field      | Type                       | Required | Validation                                        |
| ---------- | -------------------------- | -------- | ------------------------------------------------- |
| `planCode` | `FREE \| PLUS \| BUSINESS` | yes      | DTO enum validation; selected plan must be active |

Success (200): response envelope with the updated Current subscription schema. The returned `isBusiness` equals `plan.enablesBusiness`.

The operation is idempotent. Selecting the current code returns the current subscription and leaves exactly one subscription row for the workspace.

Errors:

| Status | Condition                                                                   | State guarantee                                     |
| ------ | --------------------------------------------------------------------------- | --------------------------------------------------- |
| 400    | Unknown/invalid request body or forbidden extra field such as `isBusiness`  | No change                                           |
| 401    | No valid authenticated session/token                                        | No change                                           |
| 403    | Caller is not an active OWNER or ADMIN for the resolved workspace           | No change                                           |
| 404    | Plan code does not exist or is inactive, or current subscription is missing | No change                                           |
| 500    | Persistence failure                                                         | Transaction rolls back plan and entitlement changes |

The controller must document final status codes with Swagger. The service must use a single, explicit exception choice consistently for unavailable plans and cover it in tests.

## Compatibility Rules

- `POST /api/v1/workspaces` and `PATCH /api/v1/workspaces/:id` no longer accept `isBusiness`; it is rejected by the global non-whitelisted-property validation behavior.
- Existing read responses can continue to expose `Workspace.isBusiness`, but its value is now controlled only by Subscription provisioning/selection.
- Existing Business-only member and invitation operations keep their current behavior because they read the synchronized workspace projection.
- No payment, pricing, invoice, webhook, queue, CV Parser, or Notification API is added.

## Observability Contract

For a successful selection, log a structured or identifier-only message containing `workspaceId`, previous and selected plan codes, requester ID where available, and an outcome. For invalid or unauthorized selections, log `workspaceId` when resolved, requested plan code when syntactically available, and a rejection reason. Never log email addresses, workspace names, raw authorization headers, or arbitrary request bodies.
