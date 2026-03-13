<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Database seed

Seed script uses Prisma and is idempotent for core entities (`users`, `candidates`, `jobs`, `applications`).

```bash
# required by prisma/seed.ts
$ export SEED_DEFAULT_PASSWORD="Password123!"

# run seed
$ pnpm run db:seed
```

Notes:
- Do not run seed in production.
- Use a dedicated local/test database when running destructive seed tests.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

---

## Queue Migration Notes (ADR-009)

### Breaking Changes

1. **Exchange Name:** Changed from `cv_parser` to `talentflow.events`
2. **CvUploadedEvent:** Removed `fileUrl` (SSRF fix), added `bucket` field

### New Event Payload

```json
{
  "candidateId": "uuid",
  "applicationId": "uuid",
  "jobId": "uuid",
  "bucket": "talentflow-cvs",
  "fileKey": "cvs/2026/02/uuid.pdf",
  "mimeType": "application/pdf",
  "uploadedAt": "2026-02-25T10:30:00Z"
}
```

CV Parser consumers must use `bucket` + `fileKey` with S3 credentials to download files (not URLs).

See [ADR-009](../docs/adr/ADR-009-rabbitmq-polyglot.md) for full specification.

---

## Frontend API Integration (API Gateway)

Base URL (local): `http://localhost:3000`

- API prefix: `/api/v1`
- Prefix exclusions (public): `/health`, `/ready`, `/metrics`
- Swagger UI: `/api/docs` (configured with Bearer input, but runtime auth currently uses cookies)

### Global conventions

#### Authentication
- Cookie-based JWT auth for browser clients.
- Login sets cookies:
  - `access_token` (15m)
  - `refresh_token` (7d)
- Cookie options: `httpOnly`, `sameSite=strict`, `secure` in production.
- Frontend must send credentials:
  - Fetch: `credentials: 'include'`
  - Axios: `withCredentials: true`
- Important integration notes:
  - Auth strategies read JWT from cookies (not `Authorization: Bearer ...`).
  - `sameSite=strict` can block cross-site cookie usage depending on deployment topology.
  - CORS allowlist is controlled by `CORS_ORIGINS` (default local pattern in `main.ts`).

#### Success response envelope
Most successful responses are wrapped by interceptor:

```json
{
  "status": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2026-03-07T10:00:00.000Z"
}
```

If a controller returns `{ message, ...payload }`, then:
- `message` is moved to envelope `message`
- `data` contains the remaining payload (or `null` if none)

This affects endpoints like CV upload where service-level `message` appears at envelope level, not inside `data`.

#### Error response format

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": ["email must be an email"],
  "timestamp": "2026-03-07T10:00:00.000Z",
  "requestId": "..."
}
```

#### Roles
- `ADMIN`
- `RECRUITER`
- `INTERVIEWER`

---

### API Inventory

### System

#### `GET /health`
- Auth: Public
- Payload: none
- Response: health/liveness payload

#### `GET /ready`
- Auth: Public
- Payload: none
- Response: readiness payload

#### `GET /metrics`
- Auth: Public
- Payload: none
- Response: Prometheus text (`text/plain`)

### App root

#### `GET /api/v1/`
- Auth: Public
- Payload: none
- Response: greeting string (wrapped by success envelope)

### Auth

#### `POST /api/v1/auth/signup`
- Auth: Public
- Payload:

```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "fullName": "John Doe",
  "role": "RECRUITER"
}
```

- Validation:
  - `email`: valid email
  - `password`: min 8, includes upper/lower/number/special
  - `fullName`: required
  - `role`: `ADMIN | RECRUITER | INTERVIEWER`

- Response (`data`):

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "RECRUITER",
    "createdAt": "2026-03-07T10:00:00.000Z"
  }
}
```

#### `POST /api/v1/auth/login`
- Auth: Public
- Payload:

```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

- Side effects: sets `access_token` and `refresh_token` cookies
- Response (`data`):

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "RECRUITER",
    "createdAt": "2026-03-07T10:00:00.000Z"
  }
}
```

#### `POST /api/v1/auth/refresh`
- Auth: refresh cookie required (`JwtRefreshGuard`)
- Payload: none
- Side effects: rotates auth cookies
- Response: message-only success (`data` can be `null`)

#### `GET /api/v1/auth/me`
- Auth: Protected
- Payload: none
- Response (`data`):

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "RECRUITER"
  }
}
```

#### `POST /api/v1/auth/logout`
- Auth: Protected
- Payload: none
- Side effects: clears auth cookies
- Response: message-only success

### Jobs

#### `POST /api/v1/jobs`
- Auth: Protected
- Roles: `RECRUITER` or `ADMIN`
- Payload:

```json
{
  "title": "Senior Backend Engineer",
  "description": "Build scalable APIs",
  "requirements": {
    "skills": ["nestjs", "postgresql"]
  },
  "department": "Engineering",
  "location": "Ho Chi Minh City",
  "employmentType": "FULL_TIME",
  "salaryMin": 2000,
  "salaryMax": 4000,
  "status": "OPEN"
}
```

- Notes:
  - Required: `title`
  - `employmentType`: `FULL_TIME | PART_TIME | CONTRACT | INTERNSHIP`
  - `status`: `DRAFT | OPEN | CLOSED | ARCHIVED`
  - `requirements` is JSON

- Response (`data`): created job object

#### `GET /api/v1/jobs`
- Auth: Public
- Query params:
  - `page`, `limit`
  - `search`
  - `status`
  - `employmentType`
  - `department`
  - `salaryMin`, `salaryMax`
  - `skills` (comma-separated)
  - `sortBy` (`createdAt|title|salaryMin`)
  - `sortOrder` (`asc|desc`)

- Response (`data`):

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Senior Backend Engineer",
      "status": "OPEN"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

#### `GET /api/v1/jobs/:id`
- Auth: Public
- Path params: `id` (UUID)
- Response (`data`): single job object

#### `PUT /api/v1/jobs/:id`
- Auth: Protected
- Roles: `RECRUITER` or `ADMIN`
- Payload: partial fields of create job
- Path params: `id` (UUID)
- Response (`data`): updated job object

#### `DELETE /api/v1/jobs/:id`
- Auth: Protected
- Roles: `RECRUITER` or `ADMIN`
- Path params: `id` (UUID)
- Response: `204 No Content` (empty body)

### Applications

#### `POST /api/v1/applications`
- Auth: Protected
- Payload:

```json
{
  "jobId": "uuid",
  "coverLetter": "I am interested in this role",
  "cvFileKey": "cvs/2026/03/example.pdf",
  "cvFileUrl": "https://..."
}
```

- Required: `jobId`
- Response (`data`): created application object

#### `POST /api/v1/applications/upload`
- Auth: Protected
- Content-Type: `multipart/form-data`
- Form fields:
  - `file` (required)
  - `jobId` (required UUID)
  - `coverLetter` (optional)

- Response behavior:
  - Envelope `message`: `"CV uploaded successfully. Processing started."`
  - `data` payload:

```json
{
  "applicationId": "uuid",
  "fileKey": "cvs/2026/03/file.pdf",
  "fileUrl": "https://...",
  "presignedUrl": "https://...",
  "status": "processing"
}
```

`presignedUrl` is optional and may be omitted when signed URL generation fails.

#### `GET /api/v1/applications`
- Auth: Protected
- Query params:
  - `page`, `limit`
  - `jobId` (UUID)
  - `candidateId` (UUID, effective for ADMIN)
  - `stage` (`APPLIED|SCREENING|INTERVIEW|OFFER|HIRED|REJECTED`)
  - `status` (`SUBMITTED|REVIEWING|SHORTLISTED|INTERVIEW_SCHEDULED|INTERVIEWED|OFFERED|ACCEPTED|REJECTED|WITHDRAWN`)
  - `sortBy` (`appliedAt|status`)
  - `sortOrder` (`asc|desc`)

- Response (`data`): paginated list + meta

#### `GET /api/v1/applications/:id`
- Auth: Protected
- Path params: `id` (UUID)
- Response (`data`): single application object

#### `PUT /api/v1/applications/:id`
- Auth: Protected
- Path params: `id` (UUID)
- Payload (partial):

```json
{
  "stage": "INTERVIEW",
  "status": "INTERVIEW_SCHEDULED",
  "notes": "Strong communication",
  "coverLetter": "Updated cover letter"
}
```

- Response (`data`): updated application object

#### `DELETE /api/v1/applications/:id`
- Auth: Protected
- Path params: `id` (UUID)
- Response: `204 No Content` (empty body)

---

### Source-of-truth files
- Controllers:
  - `src/auth/auth.controller.ts`
  - `src/jobs/jobs.controller.ts`
  - `src/applications/applications.controller.ts`
  - `src/health/health.controller.ts`
  - `src/metrics/metrics.controller.ts`
- DTOs:
  - `src/auth/dto/*.ts`
  - `src/jobs/dto/*.ts`
  - `src/applications/dto/*.ts`
- Global behavior:
  - `src/main.ts`
  - `src/common/interceptors/transform.interceptor.ts`
  - `src/common/filters/http-exception.filter.ts`
  - `src/auth/constants/auth.constants.ts`
