# API Gateway API Contracts

**Status:** Implemented

## Contract shape

- All routes below are under `/api/v1` unless noted otherwise.
- Responses are transformed by the global interceptor into a common envelope.
- Most routes require authentication via the global JWT guard.
- `@Public()` marks unauthenticated routes.

## Public and operational endpoints

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/health` | Liveness probe | Excluded from the global prefix |
| GET | `/ready` | Readiness probe | Checks memory, database, Redis, and RabbitMQ |
| GET | `/metrics` | Prometheus metrics | Excluded from the global prefix |
| GET | `/api/v1` | Root endpoint | App controller response |
| GET | `/api/docs` | Swagger UI | Documentation only |
| GET | `/api-json` | Swagger JSON | Useful for automation |

## Auth

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/signup` | Register a user | Public |
| POST | `/api/v1/auth/login` | Login and set cookies | Public |
| POST | `/api/v1/auth/refresh` | Rotate access and refresh tokens | Refresh cookie |
| GET | `/api/v1/auth/me` | Current user profile | Access token |
| POST | `/api/v1/auth/logout` | Clear cookies and revoke token context | Access token |

### Auth response notes
- Login and refresh set access and refresh cookies.
- Profile response returns the current user identity and role.
- Logout clears both cookies.

## Users

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/users` | List users |
| GET | `/api/v1/users/:id` | Read one user |
| PATCH | `/api/v1/users/:id` | Update a user |
| PATCH | `/api/v1/users/:id/role` | Update user role |
| DELETE | `/api/v1/users/:id` | Soft-delete or remove a user |

## Jobs

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/jobs` | Create a job |
| GET | `/api/v1/jobs` | List jobs |
| GET | `/api/v1/jobs/:id` | Read one job |
| PUT | `/api/v1/jobs/:id` | Update a job |
| DELETE | `/api/v1/jobs/:id` | Delete a job |

## Candidates

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/candidates` | List candidates |
| GET | `/api/v1/candidates/:id` | Read one candidate |
| PATCH | `/api/v1/candidates/:id` | Update a candidate |
| DELETE | `/api/v1/candidates/:id` | Delete a candidate |

## Applications

| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/api/v1/applications` | Apply to a job | JSON body |
| POST | `/api/v1/applications/upload` | Apply with CV upload | `multipart/form-data` |
| GET | `/api/v1/applications` | List applications | Role-filtered |
| GET | `/api/v1/applications/:id` | Read one application | Access-controlled |
| PUT | `/api/v1/applications/:id` | Update an application | Recruiter/admin/applicant rules apply |
| DELETE | `/api/v1/applications/:id` | Withdraw an application | Candidates only |

### CV upload response
The upload endpoint returns processing metadata immediately, including:
- `applicationId`
- `fileKey`
- `fileUrl`
- optional `presignedUrl`
- `status: processing`
- a success message

### Applications list response
List endpoints return a `data` array and pagination metadata.

## Interviews

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/interviews` | Create an interview |
| GET | `/api/v1/interviews` | List interviews |
| GET | `/api/v1/interviews/:id` | Read one interview |
| PATCH | `/api/v1/interviews/:id` | Update an interview |
| DELETE | `/api/v1/interviews/:id` | Delete an interview |

## Workspaces

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/workspaces` | Create a workspace |
| POST | `/api/v1/workspaces/:id/members` | Add a member |
| GET | `/api/v1/workspaces/:id/members` | List members |

## Analytics

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/analytics/overview` | High-level metrics |
| GET | `/api/v1/analytics/pipeline` | Pipeline breakdown |
| GET | `/api/v1/analytics/trends` | Trend data |
| GET | `/api/v1/analytics/top-jobs` | Top-performing jobs |

## Common behavior

- Validation is strict and rejects unknown properties.
- Route-level authorization is enforced by global guards plus role checks inside services.
- Errors are surfaced as Nest HTTP exceptions and normalized by the global filter.
- Pagination responses use `meta` fields such as `total`, `page`, `limit`, and `totalPages` where relevant.

## Important implementation notes

- `cv.uploaded` is the only queue message that is definitely emitted by the current gateway code.
- `application.created` appears in constants and legacy planning docs, but should be treated carefully unless you confirm the current emitter path.
- The API docs should always preserve the `/api/v1` prefix for everything except `health`, `ready`, and `metrics`.
