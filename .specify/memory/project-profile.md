# Project Profile

## Tech Stack
| Category | Detected |
|----------|----------|
| **Primary language** | TypeScript, Java |
| **Frameworks** | NestJS (api-gateway, notification), Spring Boot (cv-parser) |
| **Database** | PostgreSQL (Prisma ORM for TS, JPA for Java), Redis, MinIO |
| **Testing** | Jest (api-gateway, notification), JUnit (cv-parser) |
| **CI/CD** | GitHub Actions (`.github/workflows/`) |
| **Package manager** | npm (api-gateway, notification), Maven/Gradle (cv-parser) |
| **Infrastructure**| Docker Compose, Kubernetes (`k8s/`) |

## Architecture
- **Pattern**: Polyglot Microservices
- **API Gateway**: `api-gateway/` — NestJS, primary entry point, handles Auth/Jobs/Applications, Prisma + Postgres
- **CV Parser Worker**: `cv-parser/` — Spring Boot, asynchronous CV processing worker, handles document parsing + AI integration
- **Notification Service**: `notification/` — NestJS, handles emails and WebSockets via RabbitMQ events
- **Event Bus**: RabbitMQ for asynchronous communication

## Module Map
| Module | Path | Purpose | Dependencies |
|--------|------|---------|-------------|
| API Gateway | `api-gateway/` | Main HTTP API, Auth, Orchestration | PostgreSQL, Redis, RabbitMQ, MinIO |
| CV Parser | `cv-parser/` | CV Processing & AI scoring worker | PostgreSQL, RabbitMQ, MinIO, External LLM API |
| Notification | `notification/` | Email & WebSocket delivery | PostgreSQL, Redis, RabbitMQ |
| Docs | `docs/` | System Documentation | — |
| Specs | `specs/` | Feature Specifications | — |

## Conventions
- **File naming**: kebab-case for TS files, PascalCase for Java files
- **Branch pattern**: `<Username>/<Type>/<Feature>` (e.g., `VuongND/refactor/bmad-standardize-docs`, `KietDM/notification/feat/phase2`)
- **Commit style**: Conventional Commits (`feat(scope): message`)
- **Test location**: `src/**/*.spec.ts` (TS), `src/test/java/**` (Java)
- **Validation**: Strict validation at boundaries (class-validator for NestJS)

## Existing Governance
- ✅ `CLAUDE.md`
- ✅ `AGENTS.md`
- ✅ `docs/architecture.md` and other documentation in `docs/`
- ✅ `.specify/` (spec-kit setup initialized)
- ✅ `.specify/memory/constitution.md` (Already exists with custom rules)

## Recommendations
- Run `/speckit-brownfield-bootstrap` to complete the tailored spec-kit configuration
- Keep testing commands specific to the module boundary
- Ensure templates reflect the tri-service architecture (API Gateway, CV Parser, Notification)