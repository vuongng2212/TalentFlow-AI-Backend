# OpenAPI Contracts

This directory contains checked-in OpenAPI contracts for completed API surfaces.

## API Gateway

- [API Gateway Full OpenAPI](api-gateway.openapi.json): Generated from the current API Gateway runtime decorators. Covers auth, users, jobs, applications, candidates, interviews, analytics, billing-only subscriptions, health, readiness, and metrics.

## Current API Gateway Paths

- `GET /api/v1`
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users`
- `GET /api/v1/users/{id}`
- `PATCH /api/v1/users/{id}`
- `PATCH /api/v1/users/{id}/role`
- `DELETE /api/v1/users/{id}`
- `GET /api/v1/jobs`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/{id}`
- `PUT /api/v1/jobs/{id}`
- `DELETE /api/v1/jobs/{id}`
- `GET /api/v1/applications`
- `POST /api/v1/applications`
- `POST /api/v1/applications/upload`
- `GET /api/v1/applications/{id}`
- `PUT /api/v1/applications/{id}`
- `DELETE /api/v1/applications/{id}`
- `GET /api/v1/candidates`
- `GET /api/v1/candidates/{id}`
- `PATCH /api/v1/candidates/{id}`
- `DELETE /api/v1/candidates/{id}`
- `GET /api/v1/interviews`
- `POST /api/v1/interviews`
- `GET /api/v1/interviews/{id}`
- `PATCH /api/v1/interviews/{id}`
- `DELETE /api/v1/interviews/{id}`
- `GET /api/v1/analytics/overview`
- `GET /api/v1/analytics/pipeline`
- `GET /api/v1/analytics/trends`
- `GET /api/v1/analytics/top-jobs`
- `GET /api/v1/subscriptions/plans`
- `GET /api/v1/subscriptions/me`
- `POST /api/v1/subscriptions/checkout`
- `POST /api/v1/subscriptions/momo/ipn`
- `POST /api/v1/internal/subscriptions/payments/{paymentId}/confirm`
- `GET /health`
- `GET /ready`
- `GET /metrics`

## Notes

- Runtime source of truth remains the owning service code and Prisma schema.
- Contracts here should be updated when API Gateway controller routes, request DTOs, response shapes, or authorization behavior change.
- The API Gateway also serves Swagger UI at `/api/docs` when Swagger is enabled.
