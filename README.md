# TalentFlow AI - Backend

> **AI-Powered Applicant Tracking System (ATS)** built with **Polyglot 3-Service Architecture**: NestJS + Spring Boot + NestJS.

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

We use a **Polyglot 3-Service Architecture** to leverage team expertise and handle CPU-intensive workloads efficiently:

```
┌────────────────────────────────────────────────────┐
│            FRONTEND (Next.js 16)                    │
│              [ALREADY COMPLETED]                    │
└─────────────────────┬──────────────────────────────┘
                      │ REST API (HTTPS)
┌─────────────────────┴──────────────────────────────┐
│         Service 1: API Gateway (NestJS)             │
│  - REST API endpoints                               │
│  - JWT Authentication + RBAC                        │
│  - Jobs/Candidates CRUD                             │
│  - File upload to Cloudflare R2                     │
│  - BullMQ Producer                                  │
└──────┬─────────────────────────┬────────────────────┘
       │                         │
       │ BullMQ (Redis)         │ PostgreSQL (Shared)
       │                         │
┌──────▼────────────────┐  ┌────▼────────────────────┐
│ Service 2: CV Parser  │  │ Service 3: Notification │
│   (Spring Boot)       │  │      (NestJS)           │
│ - BullMQ Consumer     │  │ - BullMQ Consumer       │
│ - PDF/DOCX parsing    │  │ - WebSocket real-time   │
│ - Tesseract OCR       │  │ - Email notifications   │
│ - AI Score (LLM API)  │  │                         │
└───────────────────────┘  └─────────────────────────┘
```

**Why 3 Services?**
- ✅ **CPU-Intensive Isolation**: Spring Boot handles Tesseract OCR without blocking Node.js event loop
- ✅ **Technology Fit**: Best tool for each job (NestJS for API, Java for PDF parsing)
- ✅ **Independent Scaling**: Scale CV Parser horizontally for high load
- ✅ **Clear Boundaries**: Each service has single responsibility (SOLID SRP)

**See:** [ADR-006: Polyglot 3-Service Architecture](docs/adr/ADR-006-hybrid-microservices.md)

---

## 🛠️ Tech Stack

### Service 1: API Gateway (NestJS)
| Component | Technology | Version |
|-----------|------------|---------|
| **Runtime** | Node.js | 20.x |
| **Framework** | NestJS | 10.x |
| **Language** | TypeScript | 5.x |
| **ORM** | Prisma | 5.x |
| **Queue** | BullMQ | 4.x |
| **Auth** | Passport + JWT | - |
| **Testing** | Jest | 29.x |

### Service 2: CV Parser (Spring Boot)
| Component | Technology | Version |
|-----------|------------|---------|
| **Runtime** | Java JDK | 17+ |
| **Framework** | Spring Boot | 3.x |
| **PDF Parsing** | Apache PDFBox | 3.x |
| **DOCX Parsing** | Apache POI | 5.x |
| **OCR** | Tesseract | 5.x |
| **Queue** | BullMQ (via Redis) | - |

### Service 3: Notification (NestJS)
| Component | Technology | Version |
|-----------|------------|---------|
| **Runtime** | Node.js | 20.x |
| **Framework** | NestJS | 10.x |
| **WebSocket** | Socket.io | 4.x |
| **Email** | SendGrid/Resend | - |

### Shared Infrastructure
| Component | Technology | Version |
|-----------|------------|---------|
| **Database** | PostgreSQL | 16.x |
| **Queue** | BullMQ (Redis) | 7.x |
| **Storage** | Cloudflare R2 | - |
| **Cache** | Redis | 7.x |

---

## 📦 Prerequisites

Make sure you have installed:

- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- **Java JDK** >= 17 ([Download](https://adoptium.net/)) - for CV Parser service
- **Maven** or **Gradle** ([Download](https://maven.apache.org/))
- **Docker** & **Docker Compose** ([Download](https://www.docker.com/))
- **Git** ([Download](https://git-scm.com/))

**Optional but recommended:**
- **VS Code** with extensions: ESLint, Prettier, Prisma
- **IntelliJ IDEA** (for Spring Boot service)

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/talentflow-backend.git
cd talentflow-backend
```

### 2. Setup Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Required Environment Variables:**

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/talentflow_dev"

# JWT
JWT_SECRET="your-super-secret-key-change-this"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Redis (BullMQ + Cache)
REDIS_URL="redis://localhost:6379"

# Cloudflare R2 Storage
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET="talentflow-cvs"
R2_PUBLIC_URL="https://your-bucket.r2.cloudflarestorage.com"

# LLM API (for CV scoring)
ANTHROPIC_API_KEY="sk-ant-..."  # or OPENAI_API_KEY

# App
PORT=3000
NODE_ENV=development
```

### 3. Start Infrastructure Services

Start PostgreSQL and Redis using Docker:

```bash
docker-compose up -d
```

**Verify services are running:**

```bash
docker-compose ps
```

You should see:
- ✅ `postgres` (port 5432)
- ✅ `redis` (port 6379)

### 4. Setup Each Service

#### Service 1: API Gateway (NestJS)

```bash
cd api-gateway

# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) Seed database
npx prisma db seed

# Start in development mode
npm run start:dev
```

#### Service 2: CV Parser (Spring Boot)

```bash
cd cv-parser

# Install dependencies
mvn clean install

# Start Spring Boot application
mvn spring-boot:run

# Or using Gradle
gradle bootRun
```

#### Service 3: Notification (NestJS)

```bash
cd notification-service

# Install dependencies
npm install

# Start in development mode
npm run start:dev
```

### 5. Verify Installation

Open your browser and navigate to:

- **API Gateway**: http://localhost:3000
- **Swagger API Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health
- **CV Parser**: http://localhost:8080/actuator/health
- **Notification Service**: http://localhost:3001/health

---

## 📁 Project Structure

```
talentflow-backend/  (Single Git Repository)
│
├── api-gateway/                  # Service 1: NestJS API Gateway
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/             # JWT Auth + RBAC
│   │   │   ├── users/            # User management
│   │   │   ├── jobs/             # Job CRUD
│   │   │   ├── candidates/       # Candidate management
│   │   │   ├── applications/     # Application tracking
│   │   │   └── upload/           # File upload → R2
│   │   ├── main.ts
│   │   └── app.module.ts
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
│
├── cv-parser/                    # Service 2: Spring Boot CV Parser
│   ├── src/main/java/
│   │   └── com/talentflow/parser/
│   │       ├── consumer/         # BullMQ consumer
│   │       ├── service/
│   │       │   ├── PdfParserService.java
│   │       │   ├── TesseractService.java
│   │       │   └── LlmScoringService.java
│   │       └── CvParserApplication.java
│   ├── src/test/java/
│   ├── pom.xml (or build.gradle)
│   └── application.yml
│
├── notification-service/         # Service 3: NestJS Notification
│   ├── src/
│   │   ├── gateways/
│   │   │   └── websocket.gateway.ts
│   │   ├── services/
│   │   │   └── email.service.ts
│   │   ├── main.ts
│   │   └── app.module.ts
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                       # Shared code
│   ├── types/                    # TypeScript types
│   ├── configs/                  # Config templates
│   └── scripts/                  # Build scripts
│
├── docs/                         # Documentation
│   ├── adr/                      # Architecture Decision Records
│   ├── PRD.md                    # Product Requirements
│   ├── SRS.md                    # Software Requirements
│   ├── DATABASE_SCHEMA.md        # Database design
│   ├── API_REFERENCE.md          # API docs
│   ├── SECURITY.md               # Security policy
│   └── PROJECT_SUMMARY.md        # Project overview
│
├── .github/workflows/            # CI/CD pipelines
├── docker-compose.yml            # Local dev infrastructure
├── .env.example                  # Environment template
└── README.md                     # This file
```

---

## 💻 Development

### Service 1: API Gateway (NestJS)

```bash
cd api-gateway

# Development
npm run start:dev              # Watch mode
npm run start:debug            # Debug mode

# Build
npm run build

# Testing
npm run test                   # Unit tests
npm run test:watch             # Watch mode
npm run test:cov               # Coverage
npm run test:e2e               # E2E tests

# Database
npm run prisma:generate        # Generate Prisma Client
npm run prisma:migrate         # Run migrations
npm run prisma:studio          # DB GUI

# Code Quality
npm run lint
npm run format
```

### Service 2: CV Parser (Spring Boot)

```bash
cd cv-parser

# Development
mvn spring-boot:run            # Start with Maven
gradle bootRun                 # Start with Gradle

# Build
mvn clean package              # Build JAR
gradle build                   # Build with Gradle

# Testing
mvn test                       # Run tests
mvn verify                     # Integration tests
```

### Service 3: Notification (NestJS)

```bash
cd notification-service

# Same commands as API Gateway
npm run start:dev
npm run test
npm run lint
```

### Development Workflow

1. **Pick a task** from project board
2. **Create a branch**: `git checkout -b feature/add-cv-scoring`
3. **Write code** in the appropriate service folder
4. **Write tests** (aim for 80%+ coverage)
5. **Commit** using conventional commits:
   ```bash
   git commit -m "feat(cv-parser): add tesseract OCR support"
   ```
6. **Push** and create Pull Request
7. **Wait for review** and CI/CD checks
8. **Merge** after approval

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

## 📚 Documentation

**📖 Complete Documentation Index:** [docs/INDEX.md](docs/INDEX.md)

### 🚀 Quick Start Guide
- **New to the project?** → [PROJECT_SUMMARY.md](docs/PROJECT_SUMMARY.md) (10 min read)
- **Ready to code?** → [CONTRIBUTING.md](docs/CONTRIBUTING.md) (15 min read)
- **Need architecture details?** → [ADR-006](docs/adr/ADR-006-hybrid-microservices.md)

### 📖 Essential Documentation

#### 📋 Business & Technical
| Document | Description | Priority |
|----------|-------------|----------|
| [PRD](docs/PRD.md) | Product requirements & MVP scope | ⭐⭐⭐ |
| [SRS](docs/SRS.md) | Software architecture & tech stack | ⭐⭐⭐⭐⭐ |
| [DATABASE_SCHEMA](docs/DATABASE_SCHEMA.md) | Database design with Prisma | ⭐⭐⭐⭐⭐ |
| [API_REFERENCE](docs/API_REFERENCE.md) | REST API endpoints | ⭐⭐⭐⭐ |
| [SECURITY](docs/SECURITY.md) | Security policy & GDPR | ⭐⭐⭐⭐⭐ |

#### 🏛️ Architecture Decisions (ADRs)
| Document | Topic | Status |
|----------|-------|--------|
| [ADR-001](docs/adr/ADR-001-nestjs-monorepo.md) | NestJS Monorepo | ❌ SUPERSEDED |
| [ADR-002](docs/adr/ADR-002-kafka-message-queue.md) | Apache Kafka | ❌ SUPERSEDED |
| [ADR-003](docs/adr/ADR-003-prisma-orm.md) | Prisma ORM | ✅ Active |
| [ADR-006](docs/adr/ADR-006-hybrid-microservices.md) | **3-Service Architecture** | ✅ **CURRENT** |
| [ADR-007](docs/adr/ADR-007-bullmq-over-kafka.md) | **BullMQ Queue** | ✅ **CURRENT** |
| [ADR-008](docs/adr/ADR-008-cloudflare-r2.md) | **Cloudflare R2 Storage** | ✅ **CURRENT** |

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

### BullMQ queue issues

```bash
# Check Redis connection
redis-cli ping  # Should return "PONG"

# Monitor queue in Bull Board (if installed)
# Navigate to: http://localhost:3000/admin/queues
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
