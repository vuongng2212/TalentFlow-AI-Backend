# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

## Summary

[Summarize the feature, the owning service boundary, and the smallest safe implementation path.]

## Technical Context

**Primary Runtime**: [api-gateway | cv-parser | notification | cross-service]
**Language/Version**: [TypeScript 5.x / Java 17 / mixed or NEEDS CLARIFICATION]
**Primary Dependencies**: [NestJS, Prisma, Spring Boot, RabbitMQ, Redis, MinIO, Swagger, etc.]
**Storage**: [PostgreSQL / files / queue / mixed / N/A]
**Testing**: [npm test, npm run test:e2e, mvn test, or mixed]
**Target Platform**: [Linux containers / local dev / Kubernetes / mixed]
**Project Type**: Polyglot backend services
**Performance Goals**: [feature-specific measurable goal]
**Constraints**: [runtime limits, compatibility, security, async behavior]
**Scale/Scope**: [which module(s), how many contracts, how many migrations]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Runtime code and current Spec Kit artifacts are authoritative.
- Frozen legacy sources are context only and must not be indexed as active requirements.
- Service boundaries must remain explicit.
- Cross-service changes require producer and consumer alignment.
- Schema changes in the gateway require schema and migration updates together.
- Validation, logging, and failure behavior must remain boundary-focused.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
api-gateway/
├── src/
│   ├── auth/
│   ├── jobs/
│   ├── applications/
│   ├── candidates/
│   ├── interviews/
│   ├── workspaces/
│   ├── queue/
│   ├── storage/
│   ├── prisma/
│   └── common/
├── prisma/
├── test/
└── package.json

cv-parser/
├── src/main/java/com/talentflow/cvparser/
├── src/test/java/com/talentflow/cvparser/
├── src/main/resources/
└── pom.xml

notification/
├── src/
├── prisma/
├── test/
└── package.json
```

**Structure Decision**: [State which service(s) own the feature and reference the exact directories above. Add k8s/ or docs/ only if the feature changes deployment or runtime guidance.]

## Delivery Phases

### Phase 0: Discovery And Contract Check

- Confirm the owning service boundary and the runtime path the feature touches.
- Read the current schema, queue contract, or controller/service implementation that already owns the behavior.
- Identify any compatibility risk with existing consumers or producers.

### Phase 1: Design And Data Shape

- Capture the feature data model or contract shape in the plan artifacts.
- Define validation rules, invariants, and failure behavior.
- List any environment variables, feature flags, or config values that must be introduced or updated.

### Phase 2: Implementation By Service

- API Gateway work should land in `api-gateway/src/` and `api-gateway/prisma/` when the feature is HTTP- or schema-facing.
- CV Parser work should land in `cv-parser/src/main/java/com/talentflow/cvparser/` and `cv-parser/src/test/java/com/talentflow/cvparser/` when the feature affects queue consumption, parsing, or scoring.
- Notification work should land in `notification/src/` and `notification/prisma/` when the feature affects email, WebSocket, or notification persistence.
- Cross-service changes must update producer and consumer together, with a migration or compatibility note.

### Phase 3: Verification And Hardening

- Run the narrowest service-local tests first.
- Add or update contract tests for producer/consumer or HTTP boundary changes.
- Confirm logging, metrics, and failure paths behave as expected.

## Validation Commands

- API Gateway: `cd api-gateway && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`
- CV Parser: `cd cv-parser && mvn test`
- Notification: `cd notification && npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`

## Complexity Tracking

Use this table only if the plan needs a justified exception to the normal brownfield guardrails.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [cross-service contract change] | [reason] | [why single-service change is insufficient] |
| [schema migration] | [reason] | [why config-only change is insufficient] |
