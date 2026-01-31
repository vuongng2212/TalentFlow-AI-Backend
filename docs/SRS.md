# PART 2: SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

**Project Name:** TalentFlow AI
**Architecture Pattern:** Hybrid Microservices (Polyglot)

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

* **FR-10:** API tìm kiếm ứng viên bằng ngôn ngữ tự nhiên (VD: "Tìm ứng viên biết React và Spring Boot") qua **NestJS GraphQL Resolver** hoặc REST endpoint.

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
  "timestamp": "2026-02