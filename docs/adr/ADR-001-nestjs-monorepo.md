# ADR-001: Use NestJS Monorepo Instead of Polyglot Architecture

> ⚠️ **STATUS: SUPERSEDED by [ADR-006](./ADR-006-hybrid-microservices.md) on 2026-02-02**
>
> This ADR proposed a NestJS monorepo approach. After further analysis, the team decided to adopt a **polyglot 3-service architecture** to better handle CPU-intensive CV processing workloads. See ADR-006 for the current architecture.

**Status:** ~~Accepted~~ → **SUPERSEDED**
**Date:** 2026-02-01
**Superseded By:** [ADR-006](./ADR-006-hybrid-microservices.md) (2026-02-02)

---

## Context

We need to choose the backend architecture for TalentFlow AI. Initial plan (in SRS) suggested a Polyglot approach with Java Spring Boot for core services and NestJS for AI workers.

**Options considered:**
1. **Polyglot (Java Spring Boot + NestJS)** - Original plan
2. **NestJS Monorepo** - Unified TypeScript stack
3. **Java Spring Boot only** - Traditional enterprise stack

---

## Decision

We will use **NestJS Monorepo** with Clean Architecture.

**Architecture:**
```
NestJS Monorepo
├── apps/
│   ├── api-gateway      (Main API)
│   ├── ai-worker        (CV processing)
│   └── notification     (WebSocket/Email)
└── libs/
    ├── common           (Shared utilities)
    ├── database         (Prisma)
    ├── kafka            (Message queue)
    └── domain           (Domain models)
```

---

## Rationale

### Why NestJS Monorepo?

✅ **Pros:**
1. **Unified Tech Stack**: TypeScript end-to-end (Backend + Frontend Next.js)
2. **Team Size**: 2 full-stack developers - easier to maintain one stack
3. **Code Sharing**: Share types, DTOs, interfaces between apps
4. **Faster Development**: No context switching between Java and TypeScript
5. **Modern Ecosystem**: NPM packages, better AI/ML libraries (LangChain.js)
6. **Easier Deployment**: Single build pipeline, consistent tooling

❌ **Cons:**
1. Less mature enterprise ecosystem than Spring Boot
2. Not as battle-tested for high-scale applications

### Why NOT Polyglot?

- **Complexity**: Managing 2 tech stacks (Java + Node.js) for a 2-person team
- **Deployment Overhead**: Different build tools, runtimes, monitoring
- **Context Switching**: Developers need to switch between languages
- **Code Duplication**: Cannot share types between Java and TypeScript easily

### Why NOT Java Spring Boot only?

- Frontend is Next.js 16 (TypeScript) - having shared types is valuable
- AI/ML libraries (LangChain, OpenAI SDK) have better TypeScript support
- Team is comfortable with TypeScript

---

## Consequences

### Positive:
- Faster development velocity with unified stack
- Easier onboarding (only need to know TypeScript)
- Better type safety across frontend and backend
- Simpler deployment and monitoring

### Negative:
- Need to ensure NestJS best practices for scalability
- Less enterprise-grade patterns compared to Spring Boot
- May need to refactor to microservices later if scaling issues arise

### Mitigation:
- Follow Clean Architecture principles
- Use message queue for async communication (supports future migration)
- Implement proper monitoring and observability from day 1

---

## Why This Was Superseded

After team discussion and analysis of CV processing requirements (Tesseract OCR, PDF parsing), we identified that:

1. **CPU-intensive workloads** (Tesseract.js) would block Node.js event loop in a monorepo
2. **Team skills diversity** (Spring Boot, NestJS, ASP.NET) was underutilized
3. **Polyglot architecture** with Spring Boot for CV parsing provides better performance for CPU-bound tasks

The final decision: **3-service polyglot architecture** (see ADR-006).

---

## Related Decisions

- [ADR-002: Use Apache Kafka for Message Queue](./ADR-002-kafka-message-queue.md) - **SUPERSEDED by ADR-007**
- [ADR-003: Use Prisma as ORM](./ADR-003-prisma-orm.md) - ✅ **Still Valid**
- [ADR-006: Polyglot 3-Service Architecture](./ADR-006-hybrid-microservices.md) - **Current Architecture**
- [ADR-007: Use BullMQ over Kafka](./ADR-007-bullmq-over-kafka.md) - **Current Queue**

---

**Last Updated:** 2026-02-02 (Marked as SUPERSEDED)
