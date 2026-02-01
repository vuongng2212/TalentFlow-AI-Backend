# Recommended Claude Skills for TalentFlow AI

**Last Updated:** 2026-02-01
**Tech Stack:** NestJS Monorepo + Next.js 16 + Apache Kafka + Prisma + PostgreSQL

---

## Core Architecture & Design

### Must-Have Skills
1. **`architecture`** - System architecture design and patterns
2. **`monorepo-architect`** - NestJS monorepo best practices and workspace management
3. **`clean-code`** - Clean Architecture principles and implementation
4. **`api-design-principles`** - RESTful API and GraphQL design patterns
5. **`microservices-patterns`** - Microservices patterns (applicable to modular architecture)

### Recommended Skills
- **`event-sourcing-architect`** - Event-driven architecture with Kafka
- **`database-architect`** - PostgreSQL schema design and optimization
- **`full-stack-orchestration-full-stack-feature`** - Full-stack feature orchestration

---

## Backend Development (NestJS)

### Must-Have Skills
1. **`nestjs-expert`** ⭐ - Core NestJS development (Controllers, Services, Modules)
2. **`typescript-pro`** - Advanced TypeScript patterns and best practices
3. **`nodejs-backend-patterns`** - Node.js backend design patterns
4. **`prisma-expert`** ⭐ - Prisma ORM, migrations, and schema management
5. **`backend-security-coder`** - Security best practices (JWT, RBAC, data encryption)

### Recommended Skills
- **`nestjs-expert`** - Deep dive into Guards, Interceptors, Pipes, Filters
- **`graphql-architect`** - GraphQL schema design for search queries
- **`api-documentation-generator`** - Swagger/OpenAPI auto-generation
- **`postgresql`** - PostgreSQL optimization and advanced queries
- **`database-optimizer`** - Query optimization and indexing strategies

---

## Frontend Development (Next.js 16)

### Must-Have Skills
1. **`nextjs-app-router-patterns`** ⭐ - Next.js 16 App Router, Server Components, Server Actions
2. **`react-best-practices`** - React patterns and performance optimization
3. **`tailwind-design-system`** - TailwindCSS + Shadcn/UI component library
4. **`typescript-pro`** - TypeScript for frontend development

### Recommended Skills
- **`frontend-developer`** - General frontend best practices
- **`ui-ux-designer`** - UI/UX design principles
- **`react-state-management`** - State management patterns (if using Zustand/Redux)
- **`frontend-security-coder`** - XSS protection, CSRF prevention

---

## AI/ML Integration

### Must-Have Skills
1. **`rag-implementation`** ⭐ - RAG (Retrieval-Augmented Generation) for CV matching
2. **`langchain-architecture`** - LangChain.js for LLM orchestration
3. **`vector-database-engineer`** - Vector DB design (Pinecone/Weaviate)
4. **`embedding-strategies`** - Embedding generation and similarity search

### Recommended Skills
- **`llm-app-patterns`** - LLM application patterns
- **`ai-engineer`** - General AI engineering best practices
- **`prompt-engineer`** - Prompt engineering for CV extraction

---

## Message Broker & Event Streaming

### Must-Have Skills
1. **`event-sourcing-architect`** - Event-driven architecture patterns
2. **Custom Kafka Skill** (create if needed) - Apache Kafka producer/consumer patterns

### Recommended Skills
- **`async-python-patterns`** (adapt for Node.js) - Async processing patterns
- **`workflow-orchestration-patterns`** - Workflow and event orchestration

---

## DevOps & Infrastructure

### Must-Have Skills
1. **`docker-expert`** - Docker and Docker Compose for local development
2. **`cicd-automation-workflow-automate`** - CI/CD pipeline automation (GitHub Actions)
3. **`observability-engineer`** - Logging, monitoring, and tracing

### Recommended Skills
- **`kubernetes-architect`** - K8s for production deployment (future scaling)
- **`terraform-specialist`** - Infrastructure as Code (IaC)
- **`aws-serverless`** - AWS services (S3, SES, CloudWatch)

---

## Testing & Quality Assurance

### Must-Have Skills
1. **`tdd-orchestrator`** - Test-driven development workflow
2. **`test-automator`** - Unit, integration, and E2E testing
3. **`e2e-testing-patterns`** - End-to-end testing with Playwright/Cypress

### Recommended Skills
- **`jest-testing-patterns`** (implied in test-automator) - Jest testing for NestJS
- **`code-review-excellence`** - Code review best practices

---

## Security & Compliance

### Must-Have Skills
1. **`security-auditor`** - Security audit and vulnerability scanning
2. **`api-security-best-practices`** - API security (rate limiting, authentication)
3. **`gdpr-data-handling`** - PII data protection and GDPR compliance

### Recommended Skills
- **`auth-implementation-patterns`** - Authentication and authorization patterns
- **`secrets-management`** - Environment variables and secrets management

---

## Documentation & Code Review

### Must-Have Skills
1. **`code-documentation-doc-generate`** - Documentation generation
2. **`code-review-excellence`** - Code review standards
3. **`api-documenter`** - API documentation (Swagger/OpenAPI)

### Recommended Skills
- **`architecture-decision-records`** - ADR for architecture decisions
- **`senior-architect`** - Architecture review and technical decisions

---

## Performance & Optimization

### Must-Have Skills
1. **`performance-engineer`** - Performance profiling and optimization
2. **`database-optimizer`** - Database query optimization

### Recommended Skills
- **`web-performance-optimization`** - Frontend performance optimization
- **`nodejs-performance-optimization`** (implied) - Backend performance tuning

---

## Development Workflow

### Daily Development Skills
```bash
# Phase 1: Feature Planning
architecture → plan → nestjs-expert

# Phase 2: Backend Implementation
nestjs-expert → prisma-expert → backend-security-coder

# Phase 3: Frontend Implementation
nextjs-app-router-patterns → react-best-practices → tailwind-design-system

# Phase 4: AI Integration
rag-implementation → langchain-architecture → vector-database-engineer

# Phase 5: Testing
tdd-orchestrator → test-automator → e2e-testing-patterns

# Phase 6: Deployment
docker-expert → cicd-automation-workflow-automate → observability-engineer
```

---

## Priority Ranking

### 🔥 Critical (Use First)
1. `nestjs-expert` - Backend core
2. `nextjs-app-router-patterns` - Frontend core
3. `prisma-expert` - Database ORM
4. `rag-implementation` - AI core feature
5. `architecture` - System design

### ⭐ High Priority
6. `typescript-pro` - Language mastery
7. `monorepo-architect` - Monorepo structure
8. `langchain-architecture` - LLM orchestration
9. `vector-database-engineer` - Vector search
10. `docker-expert` - Development environment

### ✅ Medium Priority
11. `backend-security-coder` - Security implementation
12. `event-sourcing-architect` - Kafka patterns
13. `database-architect` - Schema design
14. `tdd-orchestrator` - Testing workflow
15. `cicd-automation-workflow-automate` - CI/CD setup

### 📚 Nice to Have
- `code-review-excellence` - Code quality
- `observability-engineer` - Monitoring
- `api-documentation-generator` - Docs
- `performance-engineer` - Optimization
- `gdpr-data-handling` - Compliance

---

## How to Use Skills

### Example 1: Implementing CV Upload Feature
```bash
# Step 1: Plan with architecture
/skill architecture "Design CV upload pipeline with Kafka"

# Step 2: Implement backend
/skill nestjs-expert "Create upload controller with Multer"
/skill prisma-expert "Add CV metadata schema"

# Step 3: Implement frontend
/skill nextjs-app-router-patterns "Create upload page with Server Actions"

# Step 4: Add AI processing
/skill rag-implementation "Implement CV parsing and matching"
```

### Example 2: Setting Up Monorepo
```bash
# Step 1: Initialize monorepo
/skill monorepo-architect "Setup NestJS workspace structure"

# Step 2: Configure shared libraries
/skill nestjs-expert "Create shared libs (common, database, kafka)"

# Step 3: Setup applications
/skill nestjs-expert "Create api-gateway and ai-worker apps"
```

### Example 3: Implementing Authentication
```bash
# Step 1: Design auth flow
/skill backend-security-coder "Design JWT authentication with refresh tokens"

# Step 2: Implement backend
/skill nestjs-expert "Implement Passport JWT strategy"
/skill prisma-expert "Add User schema with roles"

# Step 3: Implement frontend
/skill nextjs-app-router-patterns "Create login page with Server Actions"
```

---

## Custom Skills to Create

If these skills don't exist, consider creating custom skills:

1. **`kafka-nestjs`** - Apache Kafka integration with NestJS
2. **`pinecone-integration`** - Pinecone vector database integration
3. **`cv-parsing`** - CV/Resume parsing strategies
4. **`semantic-search`** - Semantic search implementation
5. **`ats-domain`** - ATS (Applicant Tracking System) domain expertise

---

## Next Steps

1. ✅ Review and approve this skill list
2. ⬜ Install Claude Code CLI with skill support
3. ⬜ Start with `monorepo-architect` to setup project structure
4. ⬜ Use `nestjs-expert` to scaffold core modules
5. ⬜ Follow the Development Workflow above for each feature

---

**Questions?** Ask Claude to explain any skill or suggest alternatives!
