# ADR-006: Adopt Polyglot 3-Service Architecture

**Status:** Accepted
**Date:** 2026-02-02
**Supersedes:** [ADR-001: NestJS Monorepo](./ADR-001-nestjs-monorepo.md)

---

## Context

After initial planning with NestJS Monorepo approach, we discovered critical issues that don't align with our team structure and technical requirements:

### Team Reality:
- **3 developers** with diverse tech stack expertise:
  - NestJS/TypeScript
  - Spring Boot/Java
  - ASP.NET Core/C# (or PHP)
- **Frontend already completed** - only needs API integration
- **Timeline: 8 weeks MVP**

### Technical Concerns:
1. **PDF/DOCX parsing with Tesseract OCR** - CPU-intensive, blocks Node.js event loop
2. **Team skill diversity underutilized** - NestJS-only doesn't leverage Java/C# expertise
3. **Scalability requirements** - Need to handle >1000 CVs/day without blocking API

---

## Decision

We will adopt **Polyglot 3-Service Architecture** in a **single repository (monorepo structure)**:

```
talentflow-backend/  (Single Git Repository)
├── api-gateway/          # Service 1: NestJS
├── cv-parser/            # Service 2: Spring Boot
├── notification-service/ # Service 3: NestJS
├── shared/               # Shared types, configs
└── docs/                 # Documentation
```

### Architecture Diagram:

```
┌────────────────────────────────────────────────────┐
│            FRONTEND (Next.js 16)                    │
│              [ALREADY COMPLETED]                    │
└─────────────────────┬──────────────────────────────┘
                      │ REST API
┌─────────────────────┴──────────────────────────────┐
│         Service 1: API Gateway (NestJS)             │
│  - REST API endpoints                               │
│  - JWT Authentication + RBAC                        │
│  - Jobs/Candidates CRUD                             │
│  - File upload to Cloudflare R2                     │
│  - RabbitMQ Producer (emit events)                  │
└──────┬─────────────────────────┬────────────────────┘
       │                         │
       │ RabbitMQ (AMQP)        │ PostgreSQL (Shared)
       │                         │
┌──────▼────────────────┐  ┌────▼────────────────────┐
│ Service 2: CV Parser  │  │ Service 3: Notification │
│   (Spring Boot)       │  │      (ASP.NET Core)     │
│ - RabbitMQ Consumer   │  │ - RabbitMQ Consumer     │
│ - PDF/DOCX parsing    │  │ - WebSocket real-time   │
│ - Tesseract OCR       │  │ - Email notifications   │
│ - AI Score (LLM API)  │  │                         │
└───────────────────────┘  └─────────────────────────┘
```

### Service Breakdown:

#### **Service 1: API Gateway (NestJS)** 🟢
- **Location:** `/api-gateway`
- **Responsibilities:**
  - REST API for frontend
  - Authentication & Authorization (JWT + RBAC)
  - Jobs, Candidates, Applications CRUD
  - File upload endpoint → Cloudflare R2
  - RabbitMQ Producer (emit events to queue)
  - Prisma ORM (database access)

#### **Service 2: CV Parser (Spring Boot)** 🟡
- **Location:** `/cv-parser`
- **Responsibilities:**
  - RabbitMQ Consumer (listen `cv.uploaded` queue)
  - PDF parsing (Apache PDFBox / Tika)
  - DOCX parsing (Apache POI)
  - OCR with Tesseract (for scanned PDFs)
  - Rule-based filtering or Vector embedding
  - LLM evaluation (OpenAI/Anthropic API)
  - Database update via Prisma or direct access
  - Emit `cv.parsed` event

#### **Service 3: Notification (ASP.NET Core)** 🔵
- **Location:** `/notification-service`
- **Responsibilities:**
  - RabbitMQ Consumer (listen `cv.parsed`, `cv.failed` queues)
  - WebSocket server (real-time notifications to recruiters)
  - Email service (SendGrid/Resend)

---

## Rationale

### Why Polyglot 3-Service Architecture?

✅ **Pros:**

1. **Leverages Team Expertise:**
   - Each service uses the best-fit technology
   - No forcing all developers into one language
   - Faster development velocity in familiar stacks

2. **Solves CPU-Intensive Workload:**
   - **Tesseract OCR** and PDF parsing run in separate Spring Boot service
   - Java multi-threading handles CPU-bound tasks better than Node.js
   - API Gateway responds immediately: "CV uploaded, processing..."
   - No event loop blocking

3. **Single Repository Benefits:**
   - Easy to clone and setup: `git clone talentflow-backend`
   - Shared documentation in `/docs`
   - Centralized CI/CD configuration
   - No repo sprawl (easier to manage than 3 separate repos)

4. **Independent Scaling:**
   - Scale CV Parser horizontally (CPU-intensive workload)
   - API Gateway scales for traffic
   - Notification service scales for WebSocket connections

5. **Clear Boundaries:**
   - Each service has single responsibility (SOLID SRP)
   - Easy to understand and maintain
   - Can rewrite/replace individual services

❌ **Cons:**

1. **Polyglot Complexity:** 3 different tech stacks (NestJS, Spring Boot, NestJS)
2. **Network Latency:** Inter-service communication via BullMQ adds ~10-50ms
3. **Distributed Debugging:** Need correlation IDs to trace requests
4. **Build Complexity:** Each service has different build tools (npm, maven/gradle)

### Why NOT NestJS Monolith (Single Service)?

**Problems:**
- ❌ Tesseract.js would block Node.js event loop (5-30s per CV)
- ❌ Cannot leverage Spring Boot/Java expertise for CPU-intensive tasks
- ❌ Hard to scale independently (API and CV processing together)

### Why NOT Full Microservices (5+ services)?

**Too much for MVP:**
- Team size: 3 developers
- Timeline: 8 weeks
- Features: Auth, Jobs, CV Upload
- Scale: < 10k CVs/day

**3 services is the sweet spot:**
- Simple enough to maintain
- Complex enough to solve performance problems
- Scalable for future growth

---

## Technical Design

### Communication Strategy

**1. Synchronous (REST API):**
```
Frontend ↔ API Gateway: REST API (HTTPS)
```

**2. Asynchronous (RabbitMQ - AMQP Queue):**
```
API Gateway → CV Parser: RabbitMQ queue "cv.uploaded"
CV Parser → Notification: RabbitMQ queue "cv.parsed" / "cv.failed"
```

**3. Real-time (WebSocket):**
```
Notification Service → Frontend: WebSocket events
```

### Data Flow: CV Upload

```
1. User uploads CV (Frontend)
   ↓
2. POST /api/candidates/upload (API Gateway)
   - Validate file (PDF/DOCX, max 10MB)
   - Upload to Cloudflare R2
   - Create Candidate + Application in DB
   - Emit "cv.uploaded" to RabbitMQ
   - Response: { candidateId, status: "processing" }
   ↓
3. CV Parser Service consumes queue
   - Download file from R2
   - Extract text (PDFBox/iTextSharp)
   - Parse structured data
   - Calculate AI Score
   - Update database
   - Emit "cv.parsed" to RabbitMQ
   ↓
4. Notification Service consumes queue
   - Send WebSocket to Frontend
   - Send email to recruiter
   - Update Kanban board UI
   ↓
5. Frontend displays result
   - Candidate card appears
   - AI Score badge shows (e.g., 85%)
```

### Shared Infrastructure

**Database:**
- **PostgreSQL** (Prisma ORM) - shared by all services with logical separation:
  - API Gateway owns: `users`, `jobs`, `applications`
  - CV Parser owns: `candidates` (resume_text, ai_score)
  - Notification Service: stateless (reads from Redis cache)

**Queue:**
- **RabbitMQ** (AMQP-based) - async communication between services
- See [ADR-009](./ADR-009-rabbitmq-polyglot.md) for queue design (polyglot)
- See [ADR-007](./ADR-007-bullmq-over-kafka.md) for Node.js-only alternative

**Storage:**
- **Cloudflare R2** (S3-compatible) - CV file storage
- See [ADR-008](./ADR-008-cloudflare-r2.md) for storage strategy

**Cache:**
- **Redis** - shared cache + BullMQ queue storage

---

## SOLID Compliance

This architecture follows SOLID principles:

### ✅ Single Responsibility Principle (SRP)
- API Gateway: Handle HTTP requests
- CV Parser: Parse files
- Notification: Send notifications
- Each service has ONE reason to change

### ✅ Open/Closed Principle (OCP)
- Can add new queue consumers without modifying existing services
- Can extend notification channels (SMS, Slack) without changing core logic

### ✅ Liskov Substitution Principle (LSP)
- Storage abstraction: Can swap R2 ↔ MinIO
- Queue abstraction: Can swap BullMQ ↔ Kafka
- Parser abstraction: Can swap PDFBox ↔ Tika

### ✅ Interface Segregation Principle (ISP)
- Services only expose minimal interfaces
- Queue payloads contain only necessary data
- No God objects

### ✅ Dependency Inversion Principle (DIP)
- Services depend on abstractions (Queue, Storage)
- Not coupled to concrete implementations
- Can swap infrastructure without code changes

---

## Consequences

### Positive:

✅ **Team Productivity:**
- Each developer works in comfort zone
- Parallel development (no blocking)
- Faster MVP delivery

✅ **Performance:**
- PDF parsing doesn't block API Gateway
- Can scale services independently
- Horizontal scaling for CV Parser

✅ **Maintainability:**
- Clear service boundaries
- Easy to understand codebase
- Can rewrite services individually

✅ **Testability:**
- Test services in isolation
- Mock external dependencies easily
- Fast test execution

✅ **Deployment:**
- Deploy services independently
- Rollback individual services
- Zero-downtime deployments

### Negative:

⚠️ **Operational Complexity:**
- Need to monitor 3 services
- Distributed logging/tracing
- Service discovery (mitigated by direct URLs for MVP)

⚠️ **Network Overhead:**
- Queue latency: ~10-50ms
- Database connections: 3 services vs 1

⚠️ **Data Consistency:**
- Eventual consistency between services
- Need idempotent operations
- Handle duplicate messages

### Mitigation Strategies:

**Complexity:**
- Use Docker Compose for local dev
- Single Railway/Render account for all services
- Structured logging with correlation IDs

**Network:**
- RabbitMQ is AMQP-based (reliable messaging)
- Connection pooling for database
- Acceptable latency for MVP scale

**Consistency:**
- RabbitMQ retry logic with DLQ
- Idempotent message handlers
- Database transactions where needed

---

## Migration Path

### Repository Structure:

```bash
# Single repository setup
talentflow-backend/
├── api-gateway/              # NestJS service
│   ├── src/
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
│
├── cv-parser/                # Spring Boot service
│   ├── src/main/java/
│   ├── src/test/java/
│   ├── pom.xml (or build.gradle)
│   └── application.yml
│
├── notification-service/     # Service 3: ASP.NET Core Notification
│   ├── Controllers/
│   ├── Services/
│   ├── Program.cs
│   └── appsettings.json
│
├── shared/                   # Shared code
│   ├── types/                # TypeScript types
│   ├── configs/              # Config templates
│   └── scripts/              # Build scripts
│
├── docs/                     # Documentation
│   ├── adr/
│   ├── API_REFERENCE.md
│   └── ...
│
├── .github/workflows/        # CI/CD
├── docker-compose.yml        # Local development
├── .env.example
└── README.md
```

### Future Evolution:

**When to add more services:**
- **Analytics Service:** When need advanced reporting (Phase 2+)
- **AI Matching Service:** When add semantic search with Vector DB (Phase 2)
- **Interview Service:** When add scheduling features (Phase 2+)

**When traffic scales (> 10k CVs/day):**
- Consider Kafka for event streaming
- Add service mesh (Istio/Linkerd)
- Implement distributed tracing (OpenTelemetry)

---

## Comparison with Alternatives

### Option A: Standard NestJS App (Single Service)

**Pros:**
- Simplest to deploy
- No network overhead
- Single codebase

**Cons:**
- ❌ PDF parsing blocks event loop
- ❌ Cannot leverage Java/C# expertise
- ❌ Hard to scale independently
- ❌ All developers must know TypeScript

**Verdict:** Too simple, doesn't solve core problems

---

### Option B: NestJS Monorepo (Original ADR-001)

**Pros:**
- Code sharing easy (Nx/Turborepo)
- TypeScript end-to-end
- Unified build system

**Cons:**
- ❌ Doesn't leverage polyglot team skills
- ❌ Single language (TypeScript only)
- ❌ PDF parsing still in Node.js (event loop blocking)
- ❌ Monorepo tooling complexity

**Verdict:** Wrong fit for our requirements

---

### Option C: Polyglot 3-Service Architecture (Selected) ✅

**Pros:**
- ✅ Leverages all tech stacks
- ✅ Solves CPU-blocking issue with Spring Boot
- ✅ Independent scaling
- ✅ Single repo (easy to manage)
- ✅ Clear service boundaries

**Cons:**
- Polyglot operational complexity
- Network latency via queue
- Distributed debugging

**Verdict:** Best balance for our team and requirements

---

### Option D: Full Polyglot Microservices (5+ services)

**Pros:**
- Maximum flexibility
- Best tool for each job

**Cons:**
- ❌ Too complex for MVP
- ❌ Deployment overhead
- ❌ Context switching
- ❌ Overkill for 3-person team

**Verdict:** Over-engineering

---

## Success Metrics

### Technical:
- [ ] API response time < 200ms (p95)
- [ ] CV processing time < 10s (average)
- [ ] Queue lag < 5 messages (p95)
- [ ] Service uptime > 99% (MVP)
- [ ] Zero data loss

### Team:
- [ ] Productive development in familiar tech stacks
- [ ] Clear service ownership
- [ ] Deploy independently 3+ times per week
- [ ] Sprint velocity maintained

### Business:
- [ ] MVP launched in 8 weeks
- [ ] Frontend integration seamless
- [ ] < 5 critical bugs in production
- [ ] Customer satisfied with MVP demo

---

## Related Decisions

- [ADR-001: NestJS Monorepo](./ADR-001-nestjs-monorepo.md) - **Superseded**
- [ADR-007: BullMQ over Kafka](./ADR-007-bullmq-over-kafka.md) - Queue technology (Node.js-only)
- [ADR-008: Cloudflare R2 Storage](./ADR-008-cloudflare-r2.md) - File storage
- [ADR-009: RabbitMQ for Polyglot](./ADR-009-rabbitmq-polyglot.md) - Queue technology (polyglot)

---

## References

- [Microservices Patterns](https://microservices.io/patterns/index.html)
- [Martin Fowler - Microservices](https://martinfowler.com/articles/microservices.html)
- [When to Use Microservices (And When Not To!)](https://www.youtube.com/watch?v=GBTdnfD6s5Q)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

---

**Last Updated:** 2026-02-18
**Next Review:** After MVP launch (Week 8)
