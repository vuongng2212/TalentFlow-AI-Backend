This section covers Repository identity. Part 1 of 8.

## Repository identity
- TalentFlow AI Backend is a brownfield ATS backend implemented as a multi-part monorepo with 3 parts and a polyglot microservice backend architecture.
- Primary languages are TypeScript, Java, and Markdown.
- The documentation set is generated from runtime code and configuration first; current docs treat code and runtime configuration as the source of truth.
- Current maturity is uneven by part: API Gateway is implemented, CV Parser is partially implemented, Notification is planned only.
- Shared runtime infrastructure across the implemented services is PostgreSQL, Redis, RabbitMQ, and S3-compatible storage; local storage uses MinIO and production guidance points to Cloudflare R2.
- The root docker-compose setup starts the infrastructure and API Gateway, not every service in the repository.
- The API Gateway is the only HTTP-facing runtime in the current implementation; CV Parser is a separate background worker; Notification is documentation-driven design material only.
- General setup follows the service guides: start infrastructure with `docker-compose up -d`, set up `api-gateway` with npm and Prisma, set up `cv-parser` with Maven, and treat Notification as non-runnable until code exists.
- Key product features documented in the repo are JWT auth with access and refresh cookies, RBAC and throttling, jobs/candidates/applications/interviews/workspaces CRUD, CV upload to object storage with asynchronous parsing, RabbitMQ event flow, health/readiness/metrics, Prisma-backed ATS data, and PDF/DOCX/OCR parsing with failure events.
- The gateway is the canonical HTTP surface and the parser pipeline is intentionally asynchronous.
