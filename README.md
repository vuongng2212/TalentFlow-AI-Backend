# TalentFlow AI - Backend

> **AI-Powered Applicant Tracking System (ATS)** built with **Flexible Polyglot 3-Service Architecture**: Choose the best framework for each service based on your team's expertise.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [Documentation](#documentation)

---

## 🎯 Overview

TalentFlow AI is a modern ATS that streamlines recruitment workflows with:
- **Smart CV Parsing**: Automated extraction with OCR (Tesseract)
- **AI Scoring**: LLM-based candidate evaluation
- **Workflow Management**: Track applications through hiring pipeline
- **Real-time Updates**: WebSocket notifications for status changes

**MVP Scope (Phase 1):**
- ✅ Authentication & User Management (JWT + RBAC)
- ✅ Job Posting Management (CRUD)
- ✅ CV Upload & Parsing (PDF/DOCX + OCR)
- ✅ AI Candidate Scoring

---

## 🏗️ Architecture

We use a **Flexible Polyglot 3-Service Architecture** that lets you choose the best framework for each service based on your team's expertise:

```
┌────────────────────────────────────────────────────┐
│            FRONTEND (Next.js 16)                    │
│              [ALREADY COMPLETED]                    │
└─────────────────────┬──────────────────────────────┘
                      │ REST API (HTTPS)
┌─────────────────────┴──────────────────────────────┐
│    Service 1: API Gateway (NestJS - TypeScript)     │
│  - REST API endpoints                               │
│  - JWT Authentication + RBAC                        │
│  - Jobs/Candidates CRUD                             │
│  - File upload to Cloudflare R2                     │
│  - RabbitMQ Producer                                 │
└──────┬─────────────────────────┬────────────────────┘
       │                         │
       │ RabbitMQ (AMQP)        │ PostgreSQL (Shared)
       │                         │
┌──────▼────────────────────────┐  ┌──────▼──────────────────────┐
│ Service 2: CV Parser          │  │ Service 3: Notification      │
│ (Spring Boot)                 │  │ (NestJS)                     │
│ - RabbitMQ Consumer           │  │ - RabbitMQ Consumer          │
│ - PDF/DOCX parsing            │  │ - WebSocket (Socket.IO)      │
│ - Tesseract OCR               │  │ - Email (Nodemailer)         │
│ - AI Score (LLM API)          │  │                              │
└───────────────────────────────┘  └──────────────────────────────┘
```

**Why 3 Services?**
- ✅ **CPU-Intensive Isolation**: Dedicated service handles Tesseract OCR without blocking API Gateway
- ✅ **Technology Flexibility**: Choose the best framework per service (NestJS, Spring Boot, ASP.NET Core)
- ✅ **Independent Scaling**: Scale CV Parser horizontally for high load
- ✅ **Clear Boundaries**: Each service has single responsibility (SOLID SRP)
- ✅ **Team Expertise**: Leverage your team's existing skills (TypeScript, Java, or C#)

**See:** [ADR-006: Polyglot 3-Service Architecture](docs/adr/ADR-006-hybrid-microservices.md)

---

# TalentFlow AI Backend

TalentFlow AI Backend is a brownfield ATS backend with three service folders and a single active documentation standard based on Spec Kit artifacts.

## Current stack

- API Gateway: NestJS 11, Prisma, PostgreSQL, Redis, RabbitMQ, S3-compatible storage
- CV Parser: Java 17, Spring Boot 3.3, Spring AMQP, JPA, PDFBox, Apache POI, Tess4J, Tika, Resilience4j
- Notification: NestJS 10 scaffold with Prisma, PostgreSQL, Redis, RabbitMQ, Socket.IO, and health/config wiring

## Start local infrastructure

```bash
docker-compose up -d
```

## Service commands

### API Gateway

```bash
cd api-gateway
npm install
npm run start:dev
```

### CV Parser

```bash
cd cv-parser
mvn test
mvn spring-boot:run
```

### Notification

```bash
cd notification
npm install
npm run start:dev
```

## Active documentation

- [docs/INDEX.md](docs/INDEX.md)
- [specs/001-brownfield-context/plan.md](specs/001-brownfield-context/plan.md)
- [specs/001-brownfield-context/research.md](specs/001-brownfield-context/research.md)
- [specs/001-brownfield-context/data-model.md](specs/001-brownfield-context/data-model.md)
- [specs/001-brownfield-context/quickstart.md](specs/001-brownfield-context/quickstart.md)
- [specs/001-brownfield-context/contracts/runtime-contracts.md](specs/001-brownfield-context/contracts/runtime-contracts.md)

## Archive

Legacy brownfield materials are preserved in the repository archive for historical traceability only. They are not part of the active documentation set.

### Conventional Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(api-gateway):` New feature in API Gateway
- `feat(cv-parser):` New feature in CV Parser
- `feat(notification):` New feature in Notification Service
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

**Examples:**
```bash
feat(api-gateway): add JWT refresh token endpoint
feat(cv-parser): integrate Tesseract OCR for scanned PDFs
fix(notification): resolve WebSocket connection timeout
docs(readme): update architecture diagram
```

---

## 🧪 Testing

### API Gateway Tests

```bash
cd api-gateway

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

### CV Parser Tests

```bash
cd cv-parser

# Unit + Integration tests
mvn test
```

### Coverage Goals

- **Overall**: 80%+
- **Critical paths** (auth, CV parsing, scoring): 90%+

---

### 📚 Documentation

**📖 Active Documentation Index:** [docs/INDEX.md](docs/INDEX.md)

### 🚀 Quick Start Guide
- **Need the current project context?** → [Brownfield Context Plan](specs/001-brownfield-context/plan.md)
- **Need the current runtime contract snapshot?** → [Runtime Contracts](specs/001-brownfield-context/contracts/runtime-contracts.md)

### 📖 Active Reference Set

- [Brownfield Context Plan](specs/001-brownfield-context/plan.md)
- [Research Notes](specs/001-brownfield-context/research.md)
- [Data Model](specs/001-brownfield-context/data-model.md)
- [Quickstart](specs/001-brownfield-context/quickstart.md)
- [Runtime Contracts](specs/001-brownfield-context/contracts/runtime-contracts.md)
- [Docs Index](docs/INDEX.md)

---

## 🔧 Troubleshooting

### Docker services won't start

```bash
# Stop all containers
docker-compose down

# Remove volumes and restart
docker-compose down -v
docker-compose up -d
```

### Database connection issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Verify DATABASE_URL in .env
echo $DATABASE_URL
```

### CV Parser service won't start

```bash
# Check Java version (must be >= 17)
java --version

# Check if port 8080 is free
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows

# Check Tesseract installation
tesseract --version
```

### RabbitMQ queue issues

```bash
# Check RabbitMQ is running
docker-compose ps rabbitmq

# Check RabbitMQ Management UI
# Navigate to: http://localhost:15672 (rabbitmq/rabbitmq)

# View RabbitMQ logs
docker-compose logs rabbitmq
```

---

## 📞 Support

- **Documentation**: See [docs/](docs/) folder
- **Architecture Questions**: See [ADR-006](docs/adr/ADR-006-hybrid-microservices.md)
- **Issues**: Create an issue on GitHub
- **Team Chat**: [Your team chat link]

---

## 📄 License

Private - All rights reserved © 2026 TalentFlow AI

---

**Happy Coding! 🚀**

Need help? Check [PROJECT_SUMMARY.md](docs/PROJECT_SUMMARY.md) or [CONTRIBUTING.md](docs/CONTRIBUTING.md)!
