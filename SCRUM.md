# TalentFlow AI - Scrum Board

> **Last Updated:** 2026-02-26
> **Current Sprint:** Sprint 1 (CV Parser Phase 2 + Notification Phase 1)

---

## Team Members

| Role | Member | Focus Area |
|------|--------|------------|
| Team Lead | TBD | Architecture, Integration, Scoring |
| Core Java Dev | TBD | CV Parser - Parsing, Extraction |
| .NET Dev | TBD | Notification Service |

---

## CV Parser Service (Java/Spring Boot)

### DONE - Phase 1: Project Setup

| ID | Task | Owner | Points | Status |
|----|------|-------|--------|--------|
| CVP-001 | Create Maven project with Spring Boot 3.3.0 | Team Lead | 2 | Done |
| CVP-002 | Add dependencies (AMQP, JPA, PDFBox, POI, Tess4J) | Team Lead | 2 | Done |
| CVP-003 | Create application.yml configs (dev/prod/test) | Team Lead | 2 | Done |
| CVP-004 | Setup RabbitMqConfig (ADR-009 topology) | Team Lead | 3 | Done |
| CVP-005 | Setup S3Config, GeminiConfig, ThreadPoolConfig | Team Lead | 3 | Done |
| CVP-006 | Create DTOs with validation annotations | Team Lead | 3 | Done |
| CVP-007 | Create exceptions and utilities | Team Lead | 2 | Done |
| CVP-008 | Add health checks and Docker setup | Team Lead | 3 | Done |
| CVP-009 | Add startup validation (fail-fast) | Team Lead | 2 | Done |

---

### Phase 2: Parsing Module

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| CVP-010 | StorageAdapter - S3 download (bucket+fileKey) | | 3 | P1-High | TODO |
| CVP-011 | PdfBoxParserImpl with XXE protection | | 5 | P0-Critical | TODO |
| CVP-012 | PoiDocxParserImpl with XXE + ZIP-slip protection | | 5 | P0-Critical | TODO |
| CVP-013 | TesseractOcrImpl with 20 page limit | | 3 | P2-Medium | TODO |
| CVP-014 | DocumentParserService factory | | 2 | P1-High | TODO |
| CVP-015 | RabbitMQ Consumer with manual ACK | | 5 | P1-High | TODO |
| CVP-016 | CvParsingUseCase orchestration | | 3 | P1-High | TODO |

**Gate:** PDF/DOCX parsing works with sample files

---

### Phase 3: Extraction Module

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| CVP-017 | Extraction Models + JSON Schema | | 3 | P1-High | TODO |
| CVP-018 | RuleBasedExtractor (email, phone, LinkedIn regex) | | 3 | P1-High | TODO |
| CVP-019 | GeminiLlmClient with CircuitBreaker, Retry | | 5 | P0-Critical | TODO |
| CVP-020 | Prompt template with system/user separation | | 3 | P1-High | TODO |
| CVP-021 | JSON schema validation for LLM response | | 3 | P1-High | TODO |
| CVP-022 | Fallback to rule-based on LLM failure | | 2 | P2-Medium | TODO |
| CVP-023 | DataExtractionUseCase (hybrid strategy) | | 3 | P1-High | TODO |

**Gate:** Gemini API integration works with test prompts

---

### Phase 4: Scoring and Events

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| CVP-024 | DatabaseAdapter with short transactions | | 3 | P1-High | TODO |
| CVP-025 | ScoringResult, ScoringCriteria models | | 2 | P1-High | TODO |
| CVP-026 | GeminiScoringClient with CircuitBreaker | | 5 | P1-High | TODO |
| CVP-027 | CandidateScoringUseCase | | 3 | P1-High | TODO |
| CVP-028 | EventPublisherAdapter (CvParsed, CvFailed) | | 3 | P1-High | TODO |

**Gate:** Event publishing works with RabbitMQ

---

### Phase 5: Integration

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| CVP-029 | CvParsingOrchestrator (short transaction pattern) | | 5 | P0-Critical | TODO |
| CVP-030 | GlobalExceptionHandler + DLQ routing | | 3 | P1-High | TODO |
| CVP-031 | Metrics (cv_parsing_duration, gemini_api_calls) | | 2 | P2-Medium | TODO |
| CVP-032 | Structured JSON logging with correlation ID | | 2 | P2-Medium | TODO |
| CVP-033 | Code review (security focus) | | 3 | P1-High | TODO |

**Gate:** E2E flow works: message -> parse -> extract -> score -> publish

---

### Phase 6: Testing

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| CVP-034 | Unit Tests - Parsing | Core Java Dev | 5 | P1-High | TODO |
| CVP-035 | Unit Tests - Extraction with WireMock | Core Java Dev | 5 | P1-High | TODO |
| CVP-036 | Unit Tests - Scoring | Team Lead | 3 | P1-High | TODO |
| CVP-037 | Unit Tests - Orchestration | Team Lead | 3 | P1-High | TODO |
| CVP-038 | Integration Tests with Testcontainers | | 5 | P1-High | TODO |
| CVP-039 | Security Tests (XXE, ZIP-slip, prompt injection) | | 5 | P0-Critical | TODO |
| CVP-040 | Coverage Report (target: 80%+) | | 2 | P1-High | TODO |

**Gate:** 80%+ test coverage, all security tests pass

---

### Phase 7: Deployment

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| CVP-041 | Docker multi-stage build optimization | | 2 | P1-High | TODO |
| CVP-042 | CI/CD Pipeline (.github/workflows/cv-parser.yml) | | 3 | P1-High | TODO |
| CVP-043 | Environment documentation | | 2 | P2-Medium | TODO |
| CVP-044 | Runbook and troubleshooting guide | | 2 | P2-Medium | TODO |
| CVP-045 | Final review and merge to main | | 2 | P1-High | TODO |

---

## Notification Service (C#/.NET)

### Phase 1: Project Setup

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| NTF-001 | Create .NET solution and Web API project | | 2 | P1-High | TODO |
| NTF-002 | Add NuGet packages (RabbitMQ, MailKit, SignalR) | | 2 | P1-High | TODO |
| NTF-003 | Configuration setup (appsettings, Config classes) | | 3 | P1-High | TODO |
| NTF-004 | Database setup (EF Core, DbContext, migrations) | | 3 | P1-High | TODO |
| NTF-005 | JWT Authentication setup | | 3 | P1-High | TODO |
| NTF-006 | Health checks (RabbitMQ, PostgreSQL) | | 2 | P1-High | TODO |
| NTF-007 | Docker setup and docker-compose update | | 2 | P1-High | TODO |

**Gate:** Health endpoint returns healthy status

---

### Phase 2: Email Service

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| NTF-008 | Email Models and DTOs | | 2 | P1-High | TODO |
| NTF-009 | IEmailService + SmtpEmailSender (MailKit) | | 3 | P1-High | TODO |
| NTF-010 | Email retry logic with Polly | | 3 | P1-High | TODO |
| NTF-011 | Email templates (HTML) | | 2 | P2-Medium | TODO |
| NTF-012 | REST API endpoint with rate limiting | | 3 | P1-High | TODO |

**Gate:** Can send emails via API endpoint

---

### Phase 3: RabbitMQ Consumer

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| NTF-013 | RabbitMQ connection and consumer infrastructure | | 3 | P1-High | TODO |
| NTF-014 | Event DTOs matching API Gateway events | | 2 | P1-High | TODO |
| NTF-015 | Background worker for event processing | | 5 | P1-High | TODO |
| NTF-016 | NotificationService business logic | | 3 | P1-High | TODO |
| NTF-017 | ACK/NACK handling with DLQ | | 3 | P1-High | TODO |

**Gate:** Successfully consumes and processes events from RabbitMQ

---

### Phase 4: SignalR Real-time

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| NTF-018 | SignalR setup with JWT authentication | | 3 | P1-High | TODO |
| NTF-019 | NotificationHub implementation | | 3 | P1-High | TODO |
| NTF-020 | RealtimeService (send to user/role) | | 3 | P1-High | TODO |
| NTF-021 | Integration with NotificationService | | 2 | P1-High | TODO |
| NTF-022 | Browser WebSocket test | | 2 | P2-Medium | TODO |

**Gate:** Real-time notifications work in browser

---

### Phase 5: Notification History

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| NTF-023 | Database schema update and migration | | 2 | P1-High | TODO |
| NTF-024 | Notification repository (CRUD, pagination) | | 3 | P1-High | TODO |
| NTF-025 | History API endpoints | | 3 | P1-High | TODO |
| NTF-026 | Cleanup job (delete >30 days) | | 2 | P2-Medium | TODO |
| NTF-027 | Integration with NotificationService | | 2 | P1-High | TODO |

**Gate:** Can retrieve and manage notification history

---

### Phase 6: Testing and Documentation

| ID | Task | Owner | Points | Priority | Status |
|----|------|-------|--------|----------|--------|
| NTF-028 | Unit Tests (target: 80%+ coverage) | | 5 | P1-High | TODO |
| NTF-029 | Integration Tests with Testcontainers | | 5 | P1-High | TODO |
| NTF-030 | Swagger/OpenAPI documentation | | 2 | P2-Medium | TODO |
| NTF-031 | CI/CD Pipeline (.github/workflows/notification.yml) | | 3 | P1-High | TODO |
| NTF-032 | Final review and merge | | 2 | P1-High | TODO |

---

## Summary

### CV Parser Service

| Phase | Tasks | Points | Status |
|-------|-------|--------|--------|
| Phase 1: Setup | 9 | 22 | DONE |
| Phase 2: Parsing | 7 | 26 | TODO |
| Phase 3: Extraction | 7 | 22 | TODO |
| Phase 4: Scoring | 5 | 16 | TODO |
| Phase 5: Integration | 5 | 15 | TODO |
| Phase 6: Testing | 7 | 28 | TODO |
| Phase 7: Deployment | 5 | 11 | TODO |
| **Total** | **45** | **140** | |

### Notification Service

| Phase | Tasks | Points | Status |
|-------|-------|--------|--------|
| Phase 1: Setup | 7 | 17 | TODO |
| Phase 2: Email | 5 | 13 | TODO |
| Phase 3: RabbitMQ | 5 | 16 | TODO |
| Phase 4: SignalR | 5 | 13 | TODO |
| Phase 5: History | 5 | 12 | TODO |
| Phase 6: Testing | 5 | 17 | TODO |
| **Total** | **32** | **88** | |

---

## Definition of Done (DoD)

- [ ] Code compiles without errors
- [ ] Unit tests pass (80%+ coverage)
- [ ] Security tests pass (no CRITICAL/HIGH vulnerabilities)
- [ ] Code review approved
- [ ] Documentation updated
- [ ] No hardcoded secrets
- [ ] Logging follows PII redaction rules

---

## Priority Legend

| Priority | Description |
|----------|-------------|
| P0-Critical | Security-critical, blocks other work |
| P1-High | Core functionality, sprint commitment |
| P2-Medium | Important but not blocking |
| P3-Low | Nice to have, can defer |

---

## Sprint Notes

### Sprint 1 Goals
- [ ] CV Parser Phase 2 complete (Parsing Module)
- [ ] Notification Service Phase 1 complete (Project Setup)

### Blockers
- None currently

### Decisions
- 2026-02-26: CV Parser Phase 1 completed with security review passed
