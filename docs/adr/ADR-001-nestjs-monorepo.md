# ADR-001: Use NestJS Monorepo Instead of Polyglot Architecture

**Status:** Accepted
**Date:** 2026-02-01
**Deciders:** Team (2 developers)

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
- Use Kafka for async communication (supports future migration)
- Implement proper monitoring and observability from day 1

---

## Related Decisions

- [ADR-002: Use Apache Kafka for Message Queue](./ADR-002-kafka-message-queue.md)
- [ADR-003: Use Prisma as ORM](./ADR-003-prisma-orm.md)

---

**Last Updated:** 2026-02-01
