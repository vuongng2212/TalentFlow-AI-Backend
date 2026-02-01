# TalentFlow AI - Backend

> **AI-Powered Applicant Tracking System (ATS)** built with NestJS, Kafka, Prisma, and PostgreSQL.

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [Documentation](#documentation)
- [Team](#team)

---

## 🎯 Overview

TalentFlow AI is a modern ATS that streamlines recruitment workflows with:
- **Smart CV Parsing**: Automated extraction of candidate information
- **Semantic Search**: AI-powered candidate matching (Phase 2)
- **Workflow Management**: Track applications through hiring pipeline
- **Real-time Updates**: WebSocket notifications for status changes

**MVP Scope (Phase 1):**
- ✅ Authentication & User Management (RBAC)
- ✅ Job Posting Management (CRUD)
- ✅ CV Upload & Basic Parsing

---

## 🛠️ Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Runtime** | Node.js | 20.x |
| **Framework** | NestJS | 10.x |
| **Language** | TypeScript | 5.x |
| **Database** | PostgreSQL | 16.x |
| **ORM** | Prisma | 5.x |
| **Message Queue** | Apache Kafka | 3.x |
| **Cache** | Redis | 7.x |
| **Auth** | Passport + JWT | - |
| **Validation** | class-validator | - |
| **Testing** | Jest | 29.x |

---

## 📦 Prerequisites

Make sure you have installed:

- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- **npm** >= 10.0.0 (comes with Node.js)
- **Docker** & **Docker Compose** ([Download](https://www.docker.com/))
- **Git** ([Download](https://git-scm.com/))

**Optional but recommended:**
- **VS Code** with extensions:
  - ESLint
  - Prettier
  - Prisma

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/talentflow-backend.git
cd talentflow-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

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

# Kafka
KAFKA_BROKERS="localhost:9092"
KAFKA_CLIENT_ID="talentflow-api"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# Storage (MinIO/S3)
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="talentflow-cvs"

# App
PORT=3000
NODE_ENV=development
```

### 4. Start Infrastructure Services

Start PostgreSQL, Kafka, Redis, and MinIO using Docker:

```bash
docker-compose up -d
```

**Verify services are running:**

```bash
docker-compose ps
```

You should see:
- ✅ `postgres` (port 5432)
- ✅ `kafka` (port 9092)
- ✅ `zookeeper` (port 2181)
- ✅ `redis` (port 6379)
- ✅ `minio` (port 9000)

### 5. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Seed database with sample data
npm run prisma:seed
```

### 6. Start Development Server

```bash
# Start all apps in watch mode
npm run start:dev

# Or start specific app
npm run start:dev api-gateway
npm run start:dev ai-worker
```

### 7. Verify Installation

Open your browser and navigate to:

- **API Gateway**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health

You should see:
```json
{
  "status": "ok",
  "timestamp": "2026-02-01T10:00:00Z"
}
```

---

## 📁 Project Structure

```
talentflow-backend/
├── apps/                         # NestJS applications
│   ├── api-gateway/              # Main API server
│   │   ├── src/
│   │   │   ├── modules/          # Feature modules
│   │   │   │   ├── auth/         # Authentication & Authorization
│   │   │   │   ├── users/        # User management
│   │   │   │   ├── jobs/         # Job posting CRUD
│   │   │   │   ├── candidates/   # Candidate management
│   │   │   │   ├── applications/ # Application tracking
│   │   │   │   └── upload/       # File upload handling
│   │   │   ├── main.ts
│   │   │   └── app.module.ts
│   │   └── test/
│   │
│   ├── ai-worker/                # CV processing worker
│   │   ├── src/
│   │   │   ├── processors/       # Kafka consumers
│   │   │   │   ├── cv-parser.processor.ts
│   │   │   │   └── cv-uploaded.consumer.ts
│   │   │   ├── main.ts
│   │   │   └── app.module.ts
│   │   └── test/
│   │
│   └── notification-service/     # Notification service
│       ├── src/
│       │   ├── gateways/         # WebSocket gateway
│       │   ├── main.ts
│       │   └── app.module.ts
│       └── test/
│
├── libs/                         # Shared libraries
│   ├── common/                   # Common utilities
│   │   ├── guards/               # Auth, Role guards
│   │   ├── interceptors/         # Logging, Transform
│   │   ├── pipes/                # Validation pipes
│   │   ├── filters/              # Exception filters
│   │   ├── decorators/           # Custom decorators
│   │   └── constants/            # App constants
│   │
│   ├── database/                 # Prisma module
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema
│   │   │   ├── migrations/       # Migration files
│   │   │   └── seed.ts           # Seed data
│   │   └── src/
│   │       ├── prisma.service.ts
│   │       └── prisma.module.ts
│   │
│   ├── kafka/                    # Kafka module
│   │   ├── src/
│   │   │   ├── kafka.service.ts
│   │   │   ├── kafka.module.ts
│   │   │   └── topics/           # Topic definitions
│   │   └── test/
│   │
│   └── domain/                   # Domain layer
│       ├── entities/             # Domain entities
│       ├── dtos/                 # Data Transfer Objects
│       ├── interfaces/           # Service interfaces
│       └── enums/                # Domain enums
│
├── docs/                         # Documentation
│   ├── PRD.md                    # Product Requirements
│   ├── SRS.md                    # Software Requirements Spec
│   ├── CONTRIBUTING.md           # Developer guide
│   ├── DATABASE_SCHEMA.md        # Database design
│   ├── API_REFERENCE.md          # API documentation
│   ├── DEPLOYMENT.md             # Deployment guide
│   └── adr/                      # Architecture Decision Records
│
├── docker-compose.yml            # Local development services
├── .env.example                  # Environment variables template
├── nest-cli.json                 # NestJS workspace config
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
└── README.md                     # This file
```

---

## 💻 Development

### Available Scripts

```bash
# Development
npm run start:dev              # Start all apps in watch mode
npm run start:dev api-gateway  # Start specific app
npm run start:dev ai-worker

# Build
npm run build                  # Build all apps
npm run build api-gateway      # Build specific app

# Testing
npm run test                   # Run unit tests
npm run test:watch             # Run tests in watch mode
npm run test:cov               # Run tests with coverage
npm run test:e2e               # Run E2E tests

# Database
npm run prisma:generate        # Generate Prisma Client
npm run prisma:migrate         # Run migrations
npm run prisma:studio          # Open Prisma Studio (DB GUI)
npm run prisma:seed            # Seed database

# Code Quality
npm run lint                   # Run ESLint
npm run format                 # Run Prettier
npm run type-check             # TypeScript type checking
```

### Development Workflow

1. **Pick a task** from project board
2. **Create a branch**: `git checkout -b feature/add-job-module`
3. **Write code** following our [Contributing Guide](docs/CONTRIBUTING.md)
4. **Write tests** (aim for 80%+ coverage)
5. **Commit** using conventional commits:
   ```bash
   git commit -m "feat(jobs): add job creation endpoint"
   ```
6. **Push** and create Pull Request
7. **Wait for review** from teammate
8. **Merge** after approval

### Conventional Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

**Examples:**
```bash
feat(auth): add JWT refresh token logic
fix(jobs): resolve job deletion bug
docs(readme): update setup instructions
```

### Code Style

- **ESLint** for linting
- **Prettier** for formatting
- **Pre-commit hooks** via Husky (auto-format on commit)

**Run before committing:**
```bash
npm run lint && npm run format && npm run test
```

---

## 🧪 Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run specific test file
npm run test -- auth.service.spec.ts

# Run with coverage
npm run test:cov
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific E2E test
npm run test:e2e -- auth.e2e-spec.ts
```

### Coverage Goals

- **Overall**: 80%+
- **Critical paths** (auth, job CRUD): 90%+

---

## 📚 Documentation

**📖 Complete Documentation Index:** [docs/INDEX.md](docs/INDEX.md)

### 🚀 Quick Start Guide
- **New to the project?** → [PROJECT_SUMMARY.md](docs/PROJECT_SUMMARY.md) (10 min read)
- **Ready to code?** → [CONTRIBUTING.md](docs/CONTRIBUTING.md) (15 min read)
- **Need decisions & roadmap?** → [TEAM_DECISIONS.md](docs/TEAM_DECISIONS.md)

### 📖 Essential Documentation

#### 📋 Business & Technical
| Document | Description | Priority |
|----------|-------------|----------|
| [PRD](docs/PRD.md) | Product requirements & MVP scope | ⭐⭐⭐ |
| [SRS](docs/SRS.md) | Software architecture & tech stack | ⭐⭐⭐⭐⭐ |
| [DATABASE_SCHEMA](docs/DATABASE_SCHEMA.md) | Database design with Prisma | ⭐⭐⭐⭐⭐ |
| [API_REFERENCE](docs/API_REFERENCE.md) | REST API endpoints | ⭐⭐⭐⭐ |
| [SECURITY](docs/SECURITY.md) | Security policy & GDPR | ⭐⭐⭐⭐⭐ |

#### 👨‍💻 Development Guides
| Document | Description | Priority |
|----------|-------------|----------|
| [CONTRIBUTING](docs/CONTRIBUTING.md) | Git workflow & coding standards | ⭐⭐⭐⭐⭐ |
| [RECOMMENDED_SKILLS](docs/RECOMMENDED_SKILLS.md) | Claude AI skills reference | ⭐⭐⭐ |

#### 📊 Project Management
| Document | Description | Priority |
|----------|-------------|----------|
| [PROJECT_SUMMARY](docs/PROJECT_SUMMARY.md) | Quick overview & readiness | ⭐⭐⭐⭐⭐ |
| [TEAM_DECISIONS](docs/TEAM_DECISIONS.md) | Decisions & 8-week roadmap | ⭐⭐⭐⭐⭐ |

#### 🏛️ Architecture Decisions
| Document | Topic | Priority |
|----------|-------|----------|
| [ADR-001](docs/adr/ADR-001-nestjs-monorepo.md) | Why NestJS Monorepo? | ⭐⭐⭐⭐ |
| [ADR-002](docs/adr/ADR-002-kafka-message-queue.md) | Why Apache Kafka? | ⭐⭐⭐⭐ |
| [ADR-003](docs/adr/ADR-003-prisma-orm.md) | Why Prisma ORM? | ⭐⭐⭐⭐ |
| [ADR-004](docs/adr/ADR-004-deployment-strategy.md) | Vercel + Railway deployment | ⭐⭐⭐⭐ |
| [ADR-005](docs/adr/ADR-005-separate-repos.md) | Separate FE/BE repos | ⭐⭐⭐ |

**💡 Tip:** See [docs/INDEX.md](docs/INDEX.md) for detailed navigation guide

---

## 👥 Team

**2-Person Full-Stack Team:**

- **Developer 1**: [Your Name]
- **Developer 2**: [Teammate Name]

**Responsibilities:**
- Both developers work full-stack (NestJS + Next.js)
- Tasks are divided by features, not by tech stack
- Code review each other's PRs

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

### Prisma Client errors

```bash
# Regenerate Prisma Client
npm run prisma:generate

# Reset database (CAUTION: deletes all data)
npm run prisma:migrate:reset
```

### Port already in use

```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

---

## 📞 Support

- **Documentation**: See [docs/](docs/) folder
- **Issues**: Create an issue on GitHub
- **Team Chat**: [Your team chat link]

---

## 📄 License

Private - All rights reserved © 2026 TalentFlow AI

---

**Happy Coding! 🚀**

Need help? Check [CONTRIBUTING.md](docs/CONTRIBUTING.md) or ask your teammate!
