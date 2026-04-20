This section covers Repository layout and source tree. Part 3 of 8.

## Repository layout and source tree
- The repository is organized as a multi-part backend with two runtime services and one planning-only service; runtime truth comes from service folders and infrastructure files.
- `api-gateway/` is the main runtime service for the ATS backend and contains auth, users, jobs, candidates, applications, interviews, workspaces, analytics, health, metrics, queue, storage, Prisma, and tests.
- `api-gateway/src/` is organized as feature-based NestJS modules with cross-cutting code in `common/`.
- `api-gateway/prisma/` holds the database schema, seed script, and generated client output target.
- `api-gateway/test/` contains E2E and integration-oriented Jest tests.
- `cv-parser/` is the queue-driven CV parsing worker and contains the Spring Boot app, RabbitMQ listener, parser pipeline, extractor, repository placeholder, shared DTOs, Actuator config, and tests.
- `cv-parser/src/main/java/com/talentflow/cvparser/` is package-by-responsibility with `listener/`, `usecase/`, `parser/`, `extractor/`, `repository/`, and `shared/`; event DTOs live under `shared/dto`.
- `cv-parser/src/main/resources/` holds runtime configuration such as RabbitMQ, storage, OCR, LLM, Actuator, and resilience settings.
- `notification/` is planning-only and currently contains `README.md` and `IMPLEMENTATION-PHASES.md`; there is no runtime source tree in the current snapshot.
- `docs/` is the generated brownfield documentation root.
- `_bmad/` holds BMAD configuration and generated context.
- `_bmad-output/` holds BMAD workflow artifacts.
- `docker-compose.yml` defines the local infrastructure and current API Gateway runtime composition.
- `k8s/` contains Kubernetes manifests currently centered on the API Gateway.
- `README.md` is the repository-level overview.
- Key file patterns are TypeScript service files under `api-gateway/src/**/*.ts`, Java service files under `cv-parser/src/main/java/**/*.java`, and configuration files such as `docker-compose.yml`, `api-gateway/package.json`, `api-gateway/.env.example`, `api-gateway/prisma/schema.prisma`, `cv-parser/pom.xml`, and `cv-parser/src/main/resources/application.yml`.
- Development notes from the source-tree analysis: do not assume the root compose file starts every service, treat the API Gateway as the canonical HTTP surface, treat CV Parser as operationally separate, and treat Notification as design material until runtime code appears.
