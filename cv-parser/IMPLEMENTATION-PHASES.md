## Implementation Phases

> **Note:** Timeline adjusted for 2-person team (Team Lead + Core Java Dev). Original 10-day estimate extended to 3 weeks for realistic delivery.

### Progress Overview

| Phase | Name | Duration | Owner | Status |
|-------|------|----------|-------|--------|
| 1 | Project Setup & Core Infrastructure | Week 1 (Day 1-3) | Team Lead | Not Started |
| 2 | Parsing Module | Week 1-2 (Day 3-7) | Core Java Dev | Not Started |
| 3 | Extraction Module | Week 2 (Day 6-10) | Core Java Dev | Not Started |
| 4 | Scoring & Event Publishing | Week 2 (Day 6-10) | Team Lead | Not Started |
| 5 | Integration & Orchestration | Week 3 (Day 11-13) | Team Lead | Not Started |
| 6 | Testing | Week 3 (Day 11-14) | Both | Not Started |
| 7 | Deployment & Documentation | Week 3 (Day 14-15) | Team Lead | Not Started |

**Legend:** Not Started | In Progress | Completed | Blocked

---

### Dependency Matrix

Phase 1 (Setup) -> Phase 2 (Parsing) -> Phase 3 (Extraction) -> Phase 5 (Integration)
Phase 1 (Setup) -> Phase 4 (Scoring) -> Phase 5 (Integration) -> Phase 6 (Testing) -> Phase 7 (Deployment)

**Gate Criteria:**
- Phase 2 -> Phase 3: PDF/DOCX parsing works with sample files
- Phase 3 -> Phase 5: Gemini API integration works with test prompts
- Phase 4 -> Phase 5: Event publishing works with RabbitMQ
- Phase 5 -> Phase 6: E2E flow works: message -> parse -> extract -> score -> publish
- Phase 6 -> Phase 7: 80%+ test coverage, all security tests pass

---

### Phase 1: Project Setup (Week 1: Day 1-3)

**Owner:** Team Lead
**Goal:** Project skeleton with health checks working
**DoD:** curl /actuator/health returns UP

**Tasks:**
- [ ] 1.1 Create Maven project with Spring Boot 3.3.0
- [ ] 1.2 Add dependencies (AMQP, JPA, PDFBox, POI, Tess4J, Resilience4j, Gemini SDK)
- [ ] 1.3 Create application.yml configs
- [ ] 1.4 Setup RabbitMqConfig, S3Config, GeminiConfig, ThreadPoolConfig
- [ ] 1.5 Create DTOs: CvUploadedEvent, CvParsedEvent, CvFailedEvent
- [ ] 1.6 Create JPA entities and Flyway migrations
- [ ] 1.7 Configure RabbitMQ with DLQ
- [ ] 1.8 Add health checks and Docker setup
- [ ] 1.9 Add startup validation (fail-fast if secrets missing)

**Security:** Test health endpoint, verify no secrets in logs

---

### Phase 2: Parsing Module (Week 1-2: Day 3-7)

**Owner:** Core Java Dev
**Goal:** Parse PDF/DOCX files
**DoD:** Can parse sample PDFs and DOCXs

**Tasks:**
- [ ] 2.1 StorageAdapter - S3 download using bucket+fileKey (NOT URLs)
- [ ] 2.2 PdfBoxParserImpl with XXE protection (CRITICAL)
- [ ] 2.3 PoiDocxParserImpl with XXE + ZIP-slip protection (CRITICAL)
- [ ] 2.4 TesseractOcrImpl with 20 page limit
- [ ] 2.5 DocumentParserService factory
- [ ] 2.6 RabbitMQ Consumer with manual ACK
- [ ] 2.7 CvParsingUseCase orchestration

**Security:** Test XXE, ZIP-slip, file validation

---

### Phase 3: Extraction Module (Week 2: Day 6-10)

**Owner:** Core Java Dev
**Goal:** Extract structured data using rules + Gemini AI
**DoD:** Returns ExtractedProfile with name, email, skills

**Tasks:**
- [ ] 3.1 Extraction Models + JSON Schema
- [ ] 3.2 RuleBasedExtractor (email, phone, LinkedIn regex)
- [ ] 3.3 GeminiLlmClient with CircuitBreaker, Retry, RateLimiter
- [ ] 3.4 Prompt template with system/user separation
- [ ] 3.5 JSON schema validation for response
- [ ] 3.6 Fallback to rule-based on failure
- [ ] 3.7 DataExtractionUseCase (hybrid strategy)

**Security:** Test prompt injection, rate limiting

**LLM Mocking:** Use WireMock stubs in CI, never call real API

---

### Phase 4: Scoring & Events (Week 2: Day 6-10)

**Owner:** Team Lead
**Goal:** Score candidates and publish events
**DoD:** Returns score 0-100, publishes events

**Tasks:**
- [ ] 4.1 DatabaseAdapter with short transactions
- [ ] 4.2 ScoringResult, ScoringCriteria models
- [ ] 4.3 GeminiScoringClient with CircuitBreaker
- [ ] 4.4 CandidateScoringUseCase
- [ ] 4.5 EventPublisherAdapter (CvParsed, CvFailed)

**Security:** Test PII redaction in events, no stack traces

---

### Phase 5: Integration (Week 3: Day 11-13)

**Owner:** Team Lead
**Goal:** Wire all modules with short transactions
**DoD:** E2E flow works

**Tasks:**
- [ ] 5.1 CvParsingOrchestrator with short transaction pattern
- [ ] 5.2 GlobalExceptionHandler + DLQ
- [ ] 5.3 Metrics (cv_parsing_duration, gemini_api_calls)
- [ ] 5.4 Structured JSON logging with correlation ID
- [ ] 5.5 Code review

**Security:** Test idempotency, actuator security

---

### Phase 6: Testing (Week 3: Day 11-14)

**Owner:** Both
**Goal:** 80%+ test coverage
**DoD:** All tests pass, coverage >= 80%

**Tasks:**
- [ ] 6.1 Unit Tests - Parsing (Core Java Dev)
- [ ] 6.2 Unit Tests - Extraction with WireMock (Core Java Dev)
- [ ] 6.3 Unit Tests - Scoring (Team Lead)
- [ ] 6.4 Unit Tests - Orchestration (Team Lead)
- [ ] 6.5 Integration Tests with Testcontainers
- [ ] 6.6 Security Tests (XXE, ZIP-slip, prompt injection)
- [ ] 6.7 Coverage Report

---

### Phase 7: Deployment (Week 3: Day 14-15)

**Owner:** Team Lead
**Goal:** Production-ready
**DoD:** Docker works, CI green, docs complete

**Tasks:**
- [ ] 7.1 Docker multi-stage build
- [ ] 7.2 CI/CD Pipeline (.github/workflows/cv-parser.yml)
- [ ] 7.3 Environment documentation
- [ ] 7.4 Runbook and troubleshooting guide
- [ ] 7.5 Final review and merge

---

## Appendix A: Handoff Points

| From | To | When | Gate |
|------|-----|------|------|
| Team Lead | Core Java Dev | Day 3 | Health checks UP |
| Core Java Dev | Team Lead | Day 10 | Sample CVs parsed |
| Both | - | Day 15 | 80%+ coverage, CI green |

---

## Appendix B: Quick Reference

Maven: mvn clean package -DskipTests && mvn test jacoco:report
Docker: docker build -t cv-parser:latest . && docker run -p 8080:8080 --env-file .env cv-parser:latest

---

**Last updated:** 2026-02-24
