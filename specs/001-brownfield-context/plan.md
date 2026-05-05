# Implementation Plan: Brownfield Context Completion

**Branch**: `feature/brownfield-context` | **Date**: 2026-05-05 | **Spec**: [specs/001-brownfield-context/spec.md](specs/001-brownfield-context/spec.md)
**Input**: Feature specification from [specs/001-brownfield-context/spec.md](specs/001-brownfield-context/spec.md)

## Summary

Compile a single brownfield context from the archived legacy corpus and the current repository snapshot, classifying API Gateway as implemented, CV Parser as partial, and Notification as a scaffolded runtime shell, while recording legacy PRD mismatches as gaps instead of treating them as current capability.

## Technical Context

**Language/Version**: TypeScript 5.7 with NestJS 11, Java 17 with Spring Boot 3.3, and TypeScript 5.0 with NestJS 10 for the notification scaffold  
**Primary Dependencies**: NestJS, Prisma, PostgreSQL, RabbitMQ, Redis, MinIO/S3, Swagger, Prometheus/Terminus, amqplib, Spring AMQP, JPA, WebFlux, Actuator, PDFBox, Apache POI, Tess4J, Tika, Resilience4j  
**Storage**: PostgreSQL, S3-compatible object storage, Redis cache, RabbitMQ broker  
**Testing**: Jest for NestJS services, Maven/Spring Boot test stack for CV Parser, plus narrow contract and integration checks at the service boundary  
**Target Platform**: Docker Compose-backed local development and Linux container runtime  
**Project Type**: Brownfield polyglot microservice backend with planning and documentation artifacts  
**Performance Goals**: No runtime throughput target for this planning work; keep the context reviewable, source-backed, and fast to orient against  
**Constraints**: Prefer runtime truth over legacy docs, keep validation boundary-focused, preserve service boundaries, and do not promote historical PRD statements into current capability claims  
**Scale/Scope**: Three services, one shared infrastructure layer, and one brownfield context corpus spanning runtime code, generated docs, and legacy planning artifacts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Codebase truth first: pass. Current runtime code, schema, and compose config are the authority.
- Service boundaries are explicit: pass. API Gateway, CV Parser, and Notification remain distinct services with different maturity levels.
- Validate at the boundaries: pass. Contract-sensitive claims are grounded in source files and topology wiring.
- Test the contract, not the hunch: pass. The plan keeps verification at the narrowest relevant service boundary.
- Operate safely and transparently: pass. Conflicts and assumptions are recorded as gaps rather than hidden in the summary.

## Project Structure

### Documentation (this feature)

```text
specs/001-brownfield-context/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/
    └── runtime-contracts.md  # Phase 1 output
```

### Source Code (repository root)

```text
api-gateway/
├── src/
├── prisma/
└── test/

cv-parser/
├── src/main/java/com/talentflow/cvparser/
└── src/test/

notification/
├── src/
└── test/

docs/
specs/
archive/
```

**Structure Decision**: This feature is documentation-only, so all deliverables live under [specs/001-brownfield-context/](specs/001-brownfield-context/) and reference the live service directories plus the archived legacy corpus as evidence. No runtime modules are added.

## Complexity Tracking

No constitution violations require justification for this planning pass.
