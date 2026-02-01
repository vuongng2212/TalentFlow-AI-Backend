# PART 2: SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

**Project Name:** TalentFlow AI
**Architecture Pattern:** NestJS Monorepo with Clean Architecture

## 1. System Architecture Overview

Hệ thống sử dụng kiến trúc **NestJS Monorepo** với **Clean Architecture** (Modular pattern):

* **Monorepo Structure:** Tất cả services được quản lý trong một repository với NestJS workspace, giúp tái sử dụng code và dễ dàng maintain.
* **Modular Architecture:** Chia thành các modules độc lập: Auth, Job, Candidate, AI Worker, Notification - mỗi module có thể phát triển và deploy độc lập.
* **Clean Architecture Layers:**
  - **Domain Layer:** Entities, Use Cases, Business Rules - core business logic không phụ thuộc framework.
  - **Application Layer:** Service Interfaces, DTOs, Application Logic - orchestrate use cases.
  - **Infrastructure Layer:** Database (Prisma), External APIs, Message Queue (Kafka) - implementation details.
  - **Presentation Layer:** REST Controllers, WebSocket Gateways - handle HTTP/WS requests.
* **Communication:** Event-driven architecture với **Apache Kafka** để đảm bảo scalability, fault-tolerance và event streaming.

## 2. Technology Stack

| Component | Technology | Description |
| --- | --- | --- |
| **Frontend** | **Next.js 16** | TypeScript, App Router, React Server Components, Server Actions, TailwindCSS, Shadcn/UI, React Query. |
| **Backend Monorepo** | **NestJS (Workspace)** | TypeScript, Clean Architecture, Modular Design, Microservices pattern. |
| **Auth Module** | **NestJS + Passport.js** | JWT (Access Token + Refresh Token), Role-based Access Control (RBAC). |
| **ORM** | **Prisma** | Type-safe database client, migrations, schema management. |
| **Database** | **PostgreSQL 16** | Primary relational database for structured data. |
| **Vector DB** | **Pinecone / Weaviate** | Embeddings storage for Semantic Search and AI matching. |
| **Storage** | **MinIO / AWS S3** | Object storage for CV files and attachments. |
| **Message Broker** | **Apache Kafka** | Event streaming, async communication between modules, high throughput. |
| **Cache** | **Redis** | Session caching, rate limiting, pub/sub for real-time features. |
| **DevOps** | **Docker Compose** | Container orchestration for Dev/Staging environments. |
| **CI/CD** | **GitHub Actions** | Automated testing, building, and deployment pipelines. |

## 3. Functional Requirements (Detailed)

### 3.1. Authentication & Authorization (NestJS Auth Module)

* **FR-01:** Đăng nhập/Đăng ký qua Email/Password sử dụng **NestJS Passport** với Local Strategy.
* **FR-02:** Phân quyền dựa trên Role (RBAC): Admin, Recruiter, Interviewer. Sử dụng **JWT (Access Token + Refresh Token)** và `@Roles()` decorator cho route protection.

### 3.2. Job Management (NestJS Job Module)

* **FR-03:** CRUD Job Description thông qua RESTful API với **NestJS Controllers**.
* **FR-04:** Lưu trữ JD dưới dạng cấu trúc JSON trong PostgreSQL (qua **Prisma ORM**) để AI dễ dàng đối chiếu và parse.

### 3.3. CV Upload & Processing Pipeline (Event-Driven with Kafka)

**Architecture Flow:**
```
Frontend (Next.js 16)
  -> NestJS API Gateway (Upload Controller)
    -> MinIO/S3 Storage
    -> PostgreSQL (Metadata via Prisma)
    -> Kafka Producer: Topic "cv.uploaded"

Kafka Consumer (NestJS AI Worker Module)
  -> Download CV from MinIO
  -> PDF Parsing (pdf-parse / Tesseract OCR)
  -> LLM Extraction (OpenAI API)
  -> Generate Embeddings (OpenAI Embeddings API)
  -> Store in Vector DB (Pinecone/Weaviate)
  -> Kafka Producer: Topic "cv.processed"

Kafka Consumer (NestJS Core Module)
  -> Update PostgreSQL (Prisma)
  -> WebSocket/SSE notification to Frontend
```

**Detailed Requirements:**

* **FR-05 (User Action):** User upload file PDF/DOCX từ Frontend -> Gọi **Next.js 16 Server Action** hoặc API endpoint tới **NestJS Upload Controller** (sử dụng `@nestjs/platform-express` với Multer).

* **FR-06 (Storage):** NestJS validate file (size, type), upload lên **MinIO/S3** bằng AWS SDK, lưu metadata (file_url, candidate_id, job_id, status) vào **PostgreSQL** qua **Prisma**.

* **FR-07 (Async Trigger):** NestJS bắn event `cv.uploaded` (payload: `{candidateId, fileUrl, jobId}`) vào **Kafka Topic**: `cv.uploaded` sử dụng **KafkaJS** client.

* **FR-08 (AI Processing):** **NestJS AI Worker Module** lắng nghe Kafka topic `cv.uploaded`:
  - Tải file từ MinIO/S3.
  - Sử dụng **pdf-parse** (PDF) hoặc **mammoth** (Docx) để extract text.
  - Gọi **OpenAI Chat Completion API** với structured prompt để trích xuất JSON:
    ```json
    {
      "name": "...",
      "email": "...",
      "phone": "...",
      "skills": ["React", "Node.js"],
      "experience": [...]
    }
    ```
  - Gọi **OpenAI Embeddings API** để generate vector representation.
  - Lưu vector vào **Pinecone/Weaviate** với metadata.
  - Bắn event `cv.processed` (payload: `{candidateId, extractedData, score}`) vào **Kafka Topic**: `cv.processed`.

* **FR-09 (Update & Notification):** **NestJS Core Module** nhận event `cv.processed` từ Kafka, cập nhật thông tin extracted vào PostgreSQL (table `candidates`) qua Prisma, sau đó:
  - Gửi notification tới Frontend qua **WebSocket Gateway** hoặc **Server-Sent Events (SSE)**.
  - Update status trong database thành `processed`.

### 3.4. Search & Matching (NestJS Search Module)

* **FR-10:** API tìm kiếm ứng viên bằng ngôn ngữ tự nhiên (VD: "Tìm ứng viên biết React và NestJS") qua **NestJS GraphQL Resolver** hoặc REST endpoint.

* **FR-11:** Hệ thống chuyển search query thành Vector (qua OpenAI Embeddings), thực hiện **Cosine Similarity Search** trong Vector DB, trả về top N candidates với confidence score.

## 4. Database Schema Design (High-Level Entities)

**ORM:** Sử dụng **Prisma** làm ORM - type-safe database client với auto-completion và migration management.

**Core Entities:**

* **User:** `id, email, password_hash, role (enum: ADMIN|RECRUITER|INTERVIEWER), status, created_at, updated_at`
* **Job:** `id, title, description, requirements (JSON), salary_range, status (DRAFT|OPEN|CLOSED), created_by (FK: User), created_at`
* **Candidate:** `id, full_name, email, phone, linkedin_url, resume_url, resume_text, created_at`
* **Application:** `id, job_id (FK: Job), candidate_id (FK: Candidate), current_stage (enum), ai_score (float), ai_summary (text), created_at, updated_at`
* **Interview:** `id, application_id (FK: Application), interviewer_id (FK: User), scheduled_time, feedback, rating (1-5), status, created_at`

**Prisma Schema File Example:**
```prisma
// prisma/schema.prisma
model Candidate {
  id          String   @id @default(uuid())
  fullName    String   @map("full_name")
  email       String   @unique
  phone       String?
  linkedinUrl String?  @map("linkedin_url")
  resumeUrl   String   @map("resume_url")
  resumeText  String?  @map("resume_text") @db.Text

  applications Application[]

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("candidates")
}
```

**Vector Database Schema (Pinecone/Weaviate):**
- Store candidate embeddings with metadata: `{candidateId, jobId, vectorEmbedding, timestamp}`

## 5. API Interface Guidelines (Contract)

* **Standard:** RESTful API + GraphQL (cho search queries phức tạp).
* **Framework:** NestJS với decorators-based routing.

* **Response Format (REST):**
```json
{
  "status": 200,
  "message": "Success",
  "data": { ... },
  "timestamp": "2026-02-01T10:00:00Z"
}
```

* **Error Handling:** Sử dụng NestJS Exception Filters:
```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid file format",
  "timestamp": "2026-02-01T10:00:00Z"
}
```

* **NestJS Architectural Patterns:**
  - **Guards:** `@UseGuards(JwtAuthGuard, RolesGuard)` cho authentication & authorization.
  - **Interceptors:** Logging, response transformation, caching.
  - **Pipes:** DTO validation với `class-validator` và `class-transformer`.
  - **Filters:** Global exception handling.

* **GraphQL Schema (Search Example):**
```graphql
type Query {
  searchCandidates(query: String!, jobId: ID, limit: Int): [Candidate!]!
}

type Candidate {
  id: ID!
  fullName: String!
  email: String!
  aiScore: Float
  skills: [String!]!
}
```

* **Documentation:**
  - **Swagger/OpenAPI:** Auto-generated từ NestJS decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`).
  - **GraphQL Playground:** Built-in với NestJS GraphQL module.
  - Access tại: `http://localhost:3000/api/docs` (Swagger) và `http://localhost:3000/graphql` (GraphQL Playground).

## 6. NestJS Monorepo Structure

Hệ thống sử dụng **NestJS Workspace** để quản lý monorepo với nhiều applications và shared libraries.

### 6.1. Project Structure

```
talentflow-backend/
├── apps/
│   ├── api-gateway/              # Main API entry point
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   └── modules/
│   │   │       ├── auth/         # Auth module
│   │   │       ├── job/          # Job management
│   │   │       ├── candidate/    # Candidate management
│   │   │       ├── application/  # Application tracking
│   │   │       └── upload/       # File upload handling
│   │   └── test/
│   │
│   ├── ai-worker/                # CV Processing Worker
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   └── processors/
│   │   │       ├── cv-parser.processor.ts
│   │   │       ├── llm-extractor.processor.ts
│   │   │       └── vector-indexer.processor.ts
│   │   └── test/
│   │
│   └── notification-service/     # Email/WebSocket notifications
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   └── gateways/
│       │       ├── websocket.gateway.ts
│       │       └── email.service.ts
│       └── test/
│
├── libs/                         # Shared libraries
│   ├── common/                   # Common utilities
│   │   ├── src/
│   │   │   ├── guards/           # Auth guards, Role guards
│   │   │   ├── interceptors/     # Logging, Transform interceptors
│   │   │   ├── pipes/            # Validation pipes
│   │   │   ├── filters/          # Exception filters
│   │   │   ├── decorators/       # Custom decorators
│   │   │   └── constants/        # App constants
│   │   └── test/
│   │
│   ├── database/                 # Prisma client & database module
│   │   ├── src/
│   │   │   ├── prisma.service.ts
│   │   │   └── prisma.module.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── test/
│   │
│   ├── kafka/                    # Kafka producer/consumer
│   │   ├── src/
│   │   │   ├── kafka.service.ts
│   │   │   ├── kafka.module.ts
│   │   │   └── topics/
│   │   │       ├── cv-uploaded.topic.ts
│   │   │       └── cv-processed.topic.ts
│   │   └── test/
│   │
│   └── domain/                   # Domain entities, DTOs, interfaces
│       ├── src/
│       │   ├── entities/         # Domain entities
│       │   ├── dtos/             # Data Transfer Objects
│       │   ├── interfaces/       # Service interfaces
│       │   └── enums/            # Domain enums
│       └── test/
│
├── nest-cli.json                 # NestJS workspace config
├── package.json                  # Root package.json
├── tsconfig.json                 # Base TypeScript config
└── docker-compose.yml            # Docker services
```

### 6.2. Module Responsibilities

#### **apps/api-gateway**
- Main HTTP/GraphQL server
- Handles all incoming requests from Frontend
- Orchestrates business logic
- Produces events to Kafka

#### **apps/ai-worker**
- Consumes events from Kafka
- Processes CV files (parsing, extraction)
- Interacts with OpenAI API
- Stores vectors in Vector DB
- Produces processed events back to Kafka

#### **apps/notification-service**
- WebSocket server for real-time notifications
- Email service integration (SendGrid/SES)
- SMS notifications (optional)

#### **libs/common**
- Shared guards, interceptors, pipes, filters
- Custom decorators: `@CurrentUser()`, `@Roles()`, `@Public()`
- Constants and utility functions

#### **libs/database**
- Prisma client wrapper
- Database connection management
- Shared database module

#### **libs/kafka**
- Kafka producer/consumer abstractions
- Topic definitions and event schemas
- Retry logic and error handling

#### **libs/domain**
- Shared domain models (entities, DTOs)
- Business interfaces
- Domain-specific enums and constants

### 6.3. Clean Architecture Layers in Practice

```
Presentation Layer (Controllers, Gateways)
    ↓
Application Layer (Services, Use Cases)
    ↓
Domain Layer (Entities, Business Logic)
    ↓
Infrastructure Layer (Prisma, Kafka, S3, External APIs)
```

**Example: CV Upload Flow**
```typescript
// Presentation Layer
@Controller('candidates')
export class CandidateController {
  @Post('upload')
  async uploadCV(@UploadedFile() file: Express.Multer.File) {
    return this.candidateService.processCVUpload(file);
  }
}

// Application Layer
@Injectable()
export class CandidateService {
  async processCVUpload(file: File) {
    // Business logic
    const url = await this.storageService.upload(file);
    await this.kafkaService.emit('cv.uploaded', { url });
  }
}

// Infrastructure Layer
@Injectable()
export class KafkaService {
  async emit(topic: string, message: any) {
    await this.producer.send({ topic, messages: [message] });
  }
}
```

### 6.4. Environment Configuration

```
.env.development
.env.production
.env.test
```

**Key Environment Variables:**
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/talentflow"

# Kafka
KAFKA_BROKERS="localhost:9092"
KAFKA_CLIENT_ID="talentflow-api"

# Storage
S3_BUCKET="talentflow-cvs"
S3_REGION="us-east-1"

# OpenAI
OPENAI_API_KEY="sk-..."

# Vector DB
PINECONE_API_KEY="..."
PINECONE_INDEX="talentflow-candidates"

# JWT
JWT_SECRET="super-secret-key"
JWT_EXPIRES_IN="15m"
```

### 6.5. Development Commands

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start all services in dev mode
npm run start:dev

# Start specific app
npm run start:dev api-gateway
npm run start:dev ai-worker

# Run tests
npm run test
npm run test:e2e

# Build all apps
npm run build

# Lint & format
npm run lint
npm run format
```