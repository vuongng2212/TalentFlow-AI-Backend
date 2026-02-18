# Team Decisions & Action Plan

**Ngày quyết định:** 2026-02-01
**Team:** 3 Full-stack Developers (NestJS, Spring Boot, ASP.NET Core)
**Dự án:** TalentFlow AI

---

## ✅ Các Quyết định Chính Thức

### 1. Message Queue: RabbitMQ (AMQP) ✅
**Quyết định:** Sử dụng RabbitMQ (AMQP) cho polyglot architecture
**Lý do:**
- Polyglot 3-service architecture (NestJS + Spring Boot + ASP.NET Core)
- Native support cho Java (Spring AMQP), C# (RabbitMQ.Client), Node.js (amqplib)
- Built-in DLQ (Dead Letter Queue) cho CV processing retries
- Excellent Management UI tại http://localhost:15672
- BullMQ chỉ hỗ trợ Node.js, không phù hợp với polyglot

**Note:** BullMQ vẫn valid cho Node.js-only projects (xem ADR-007)

**Action Items:**
- [x] Team học RabbitMQ basics (2-3 giờ)
- [x] Thêm RabbitMQ vào docker-compose.yml
- [ ] Document RabbitMQ topology patterns
- [ ] Setup RabbitMQ Management UI monitoring

---

### 2. Security: JWT Authentication ✅
**Quyết định:** Security cơ bản với JWT (không cần SOC 2, ISO 27001 cho MVP)
**Scope:**
- ✅ JWT Access Token (15 phút) + Refresh Token (7 ngày)
- ✅ Bcrypt password hashing
- ✅ Role-based Access Control (RBAC)
- ✅ CORS, CSRF protection
- ✅ File upload validation
- ❌ Không cần compliance certification (Phase 2)

**Đã tạo:** `docs/SECURITY.md` - Đã hoàn chỉnh ✅

---

### 3. Testing: 80% Coverage ✅
**Quyết định:** Target 80% test coverage
**Breakdown:**
- Unit tests: 70% của total tests
- Integration tests: 20%
- E2E tests: 10%

**Action Items:**
- [ ] Tạo TESTING_STRATEGY.md với examples
- [ ] Setup Jest + Supertest
- [ ] Tạo test templates cho team
- [ ] CI/CD pipeline chạy tests tự động

---

### 4. Timeline: 8 tuần (Flexible) ✅
**Quyết định:** 8 tuần baseline, có thể delay theo yêu cầu khách hàng
**Chiến lược:**
- Phát triển theo sprints 2 tuần
- Regular demos cho khách hàng (mỗi 2 tuần)
- Flexible scope nếu khách hàng yêu cầu thêm features

**Milestone:**
- ✅ Tuần 0: Setup
- ✅ Tuần 1-2: Frontend Demo (Auth + Job List)
- ✅ Tuần 3-4: Backend Auth + Jobs API
- ✅ Tuần 5-6: CV Upload (Frontend + Backend)
- ✅ Tuần 7-8: Testing + Polish + Deploy

---

### 5. Monitoring: ELK Stack + Prometheus + Grafana ✅
**Quyết định:** Sử dụng monitoring stack đầy đủ
**Stack:**
- **ELK (Elasticsearch, Logstash, Kibana):** Log aggregation & search
- **Prometheus:** Metrics collection (CPU, memory, API latency)
- **Grafana:** Dashboards & visualization
- **Sentry (Optional):** Error tracking (cân nhắc thêm)

**Action Items:**
- [ ] Tạo MONITORING.md với setup guide
- [ ] Docker compose cho ELK + Prometheus + Grafana (local dev)
- [ ] Define key metrics to track
- [ ] Create dashboards templates

**Note:** Đây là monitoring stack enterprise-grade, tốt cho production nhưng có thể overkill cho MVP. Cân nhắc bắt đầu đơn giản hơn (Railway logs + Sentry) rồi migrate sau.

---

### 6. Development Order: Frontend First ✅
**Quyết định:** Frontend First để demo cho khách hàng
**Rationale:**
- Khách hàng thấy được UI/UX sớm
- Frontend có thể dùng mock data trước
- Backend develop sau khi requirements rõ ràng hơn

**New Timeline:**

#### **Phase 1: Frontend Prototype (Tuần 1-2)**
- ✅ Next.js 16 setup
- ✅ Authentication UI (Login, Signup)
- ✅ Dashboard layout
- ✅ Job listing page (mock data)
- ✅ Candidate Kanban board (mock data)
- ✅ Deploy lên Vercel
- 🎯 **Demo #1 cho khách hàng**

#### **Phase 2: Backend Foundation (Tuần 3-4)**
- ✅ NestJS monorepo setup
- ✅ PostgreSQL + Prisma
- ✅ Auth API (JWT)
- ✅ Jobs CRUD API
- ✅ Connect Frontend → Backend
- 🎯 **Demo #2: Working Auth + Jobs**

#### **Phase 3: CV Upload Feature (Tuần 5-6)**
- ✅ Frontend: CV upload UI
- ✅ Backend: File upload (MinIO/S3)
- ✅ Kafka setup (CV processing pipeline)
- ✅ Basic CV parsing (text extraction)
- 🎯 **Demo #3: End-to-end CV Upload**

#### **Phase 4: Polish & Deploy (Tuần 7-8)**
- ✅ Testing (80% coverage)
- ✅ Bug fixes
- ✅ Performance optimization
- ✅ Monitoring setup (ELK + Prometheus + Grafana)
- ✅ Production deployment
- 🎯 **Demo #4: MVP Launch**

---

## 🎯 Updated Action Plan

### 🟢 Priority 1: Frontend First (This Week - Tuần 1)

#### Developer 1: Frontend Setup
- [ ] Initialize Next.js 16 project
  ```bash
  npx create-next-app@latest talentflow-frontend --typescript --tailwind --app
  ```
- [ ] Install dependencies:
  - TailwindCSS + Shadcn/UI
  - React Query (data fetching)
  - Zustand (state management)
- [ ] Setup folder structure:
  ```
  src/
  ├── app/              # Next.js 16 App Router
  ├── components/       # Reusable components
  ├── lib/              # Utils, API client
  ├── types/            # TypeScript types
  └── mock/             # Mock data for demo
  ```
- [ ] Create layouts:
  - Authentication layout (centered)
  - Dashboard layout (sidebar + header)

#### Developer 2: UI Components & Pages
- [ ] Design system setup (Shadcn/UI components)
- [ ] Create pages:
  - `/login` - Login page
  - `/signup` - Signup page
  - `/dashboard` - Dashboard overview
  - `/jobs` - Job listing
  - `/jobs/[id]` - Job detail
  - `/candidates` - Kanban board
- [ ] Create mock data:
  ```typescript
  // mock/jobs.ts
  export const mockJobs = [
    { id: '1', title: 'Senior Developer', status: 'OPEN', ... },
    ...
  ];
  ```

#### End of Week 1:
- 🎯 **Demo-able frontend** với mock data
- 🎯 **Deploy lên Vercel**
- 🎯 **Present cho khách hàng**

---

### 🟡 Priority 2: Backend Foundation (Tuần 3-4)

#### Developer 1: NestJS Setup
- [ ] Initialize NestJS monorepo
  ```bash
  nest new talentflow-backend
  ```
- [ ] Setup Prisma
  ```bash
  npm install @prisma/client prisma
  npx prisma init
  ```
- [ ] Copy schema from `docs/DATABASE_SCHEMA.md`
- [ ] Run migrations
  ```bash
  npx prisma migrate dev
  ```
- [ ] Create shared libs:
  - `libs/database` (Prisma module)
  - `libs/common` (Guards, Interceptors)
  - `libs/domain` (DTOs, Entities)

#### Developer 2: Auth Module
- [ ] Implement Auth module:
  - `POST /auth/signup`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `GET /auth/me`
- [ ] JWT strategy với Passport
- [ ] RBAC guards (`@Roles()` decorator)
- [ ] Write unit tests (80% coverage)

#### Developer 1 (parallel): Jobs Module
- [ ] Implement Jobs CRUD:
  - `GET /jobs` (list with pagination)
  - `GET /jobs/:id` (detail)
  - `POST /jobs` (create)
  - `PATCH /jobs/:id` (update)
  - `DELETE /jobs/:id` (delete)
- [ ] Write unit tests

#### Developer 2: Frontend Integration
- [ ] Connect Frontend → Backend
- [ ] Replace mock data với real API calls
- [ ] Handle loading states, errors
- [ ] Update types từ OpenAPI spec

#### End of Week 4:
- 🎯 **Working Auth + Jobs** (full-stack)
- 🎯 **Deploy Backend lên Railway**
- 🎯 **Demo #2 cho khách hàng**

---

### 🔵 Priority 3: CV Upload (Tuần 5-6)

#### Developer 1: Backend - File Upload
- [ ] Setup MinIO (already in docker-compose)
- [ ] Implement upload endpoint:
  - `POST /candidates/upload` (multipart/form-data)
  - File validation (PDF/DOCX, max 10MB)
  - Upload to MinIO/S3
  - Save metadata to PostgreSQL
- [ ] Kafka producer: emit `cv.uploaded` event
- [ ] Write tests

#### Developer 2: Backend - AI Worker
- [ ] Create `ai-worker` app trong monorepo
- [ ] Kafka consumer: listen `cv.uploaded`
- [ ] CV parsing:
  - PDF text extraction (`pdf-parse`)
  - DOCX text extraction (`mammoth`)
  - Store parsed text in database
- [ ] Emit `cv.processed` event
- [ ] Write tests

#### Developer 1: Frontend - Upload UI
- [ ] Create upload page
- [ ] Drag & drop file upload
- [ ] Progress bar
- [ ] Real-time status updates (WebSocket or polling)

#### End of Week 6:
- 🎯 **End-to-end CV Upload** working
- 🎯 **Kafka pipeline** functional
- 🎯 **Demo #3 cho khách hàng**

---

### 🟣 Priority 4: Polish & Deploy (Tuần 7-8)

#### Developer 1: Testing & Quality
- [ ] Achieve 80%+ test coverage
- [ ] E2E tests với Playwright
- [ ] Performance testing (load test CV uploads)
- [ ] Fix bugs từ testing

#### Developer 2: Monitoring Setup
- [ ] Setup ELK Stack (Docker Compose)
  ```yaml
  # docker-compose.monitoring.yml
  services:
    elasticsearch:
    logstash:
    kibana:
    prometheus:
    grafana:
  ```
- [ ] Configure log shipping (NestJS → Logstash)
- [ ] Create Grafana dashboards:
  - API latency
  - Error rate
  - Kafka consumer lag
  - Database connections
- [ ] Setup alerts (critical errors, high latency)

#### Developer 1: Production Deployment
- [ ] Create `DEPLOYMENT.md`
- [ ] Deploy Frontend → Vercel (production)
- [ ] Deploy Backend → Railway (production)
- [ ] Setup environment variables
- [ ] Database migration
- [ ] Smoke tests

#### Developer 2: Documentation
- [ ] Complete API_REFERENCE.md
- [ ] Create user guide
- [ ] Record demo video

#### End of Week 8:
- 🎯 **MVP deployed to production**
- 🎯 **Monitoring dashboards live**
- 🎯 **Demo #4: Final MVP Launch**

---

## 📋 Critical Documents to Create

### 🔴 High Priority (Trước khi code Backend)

1. **TESTING_STRATEGY.md** (Tuần 3)
   - Test pyramid
   - Mocking strategies
   - Coverage goals
   - CI/CD integration

2. **DEPLOYMENT.md** (Tuần 7)
   - Vercel deployment
   - Railway deployment
   - Environment setup
   - Rollback procedure

3. **MONITORING.md** (Tuần 7)
   - ELK Stack setup guide
   - Prometheus configuration
   - Grafana dashboards
   - Alerting rules

### 🟡 Medium Priority

4. **ERROR_HANDLING.md** (Tuần 4)
   - Error codes
   - Logging strategy
   - Sentry integration (optional)

5. **PERFORMANCE.md** (Tuần 6)
   - Database optimization
   - Caching strategy
   - Load testing results

---

## 🎓 Learning Path (Week 0 - 3 days)

### Day 1: Frontend (8 hours)
**Developer 1 & 2:**
- Next.js 16 App Router (4 hours)
  - [Next.js Learn Course](https://nextjs.org/learn)
  - Server Components vs Client Components
  - Server Actions
- TailwindCSS + Shadcn/UI (2 hours)
  - [Shadcn/UI Docs](https://ui.shadcn.com)
- React Query (2 hours)

### Day 2: Backend (8 hours)
**Developer 1:**
- NestJS Fundamentals (6 hours)
  - [NestJS Official Course](https://learn.nestjs.com)
  - Controllers, Services, Modules
  - Dependency Injection
- Prisma (2 hours)
  - Schema definition
  - Migrations

**Developer 2:**
- NestJS Advanced (4 hours)
  - Guards, Interceptors, Pipes
  - Testing với Jest
- Kafka Basics (4 hours)
  - [Kafka in 6 Minutes](https://www.youtube.com/watch?v=Ch5VhJzaoaI)
  - KafkaJS library

### Day 3: Practice (8 hours)
**Both Developers:**
- Xây dựng Todo App nhỏ với NestJS + Prisma (4 hours)
- Setup Kafka producer/consumer đơn giản (2 hours)
- Write tests (2 hours)

**Total:** 24 hours (3 days)

---

## 📊 Sprint Planning

### Sprint 1 (Tuần 1-2): Frontend Prototype
**Goal:** Demo-able UI cho khách hàng
**Deliverables:**
- Login/Signup UI
- Dashboard
- Job listing
- Kanban board
- Mock data
- Deployed on Vercel

**Demo #1:** End of Week 2

---

### Sprint 2 (Tuần 3-4): Backend Foundation
**Goal:** Working Auth + Jobs API
**Deliverables:**
- NestJS monorepo
- Auth module (JWT)
- Jobs CRUD API
- Frontend integration
- 80% test coverage
- Deployed on Railway

**Demo #2:** End of Week 4

---

### Sprint 3 (Tuần 5-6): CV Upload
**Goal:** End-to-end CV processing
**Deliverables:**
- File upload endpoint
- Kafka pipeline
- CV parsing (text extraction)
- Upload UI
- Real-time status updates

**Demo #3:** End of Week 6

---

### Sprint 4 (Tuần 7-8): Production Ready
**Goal:** MVP launch
**Deliverables:**
- 80%+ test coverage achieved
- Monitoring setup (ELK + Prometheus + Grafana)
- Production deployment
- Documentation complete
- User guide

**Demo #4 (Launch):** End of Week 8

---

## ✅ Weekly Checklist Template

### Đầu tuần (Monday):
- [ ] Sprint planning meeting (1 hour)
- [ ] Phân công tasks
- [ ] Setup development branches

### Giữa tuần (Wednesday):
- [ ] Mid-sprint check-in (30 min)
- [ ] Blockers discussion
- [ ] Code review PRs

### Cuối tuần (Friday):
- [ ] Sprint demo preparation
- [ ] Retrospective (30 min)
  - What went well?
  - What to improve?
- [ ] Plan next sprint

---

## 🚀 Ready to Start!

**Status:** ✅ **TẤT CẢ QUYẾT ĐỊNH ĐÃ ĐƯỢC XÁC NHẬN**

### Next Immediate Actions:

#### This Week (Tuần 0):
1. ✅ Review tất cả documents
2. ✅ Setup repositories:
   - `talentflow-frontend` (GitHub)
   - `talentflow-backend` (GitHub)
3. ✅ 3-day learning sprint
4. ✅ Setup development tools:
   - VS Code extensions
   - Docker Desktop
   - Node.js 20
   - Git

#### Next Week (Tuần 1):
- 🚀 **Start Sprint 1**: Frontend Prototype
- 🎯 **Goal**: Demo cho khách hàng end of Week 2

---

**Prepared By:** Claude
**Date:** 2026-02-01
**Next Review:** Start of Sprint 2 (Week 3)
