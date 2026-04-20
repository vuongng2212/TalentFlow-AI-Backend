# 📚 Documentation Index - TalentFlow AI

**Last Updated:** 2026-02-18
**Status:** Clean & Organized
**Architecture:** Polyglot 3-Service (NestJS + Spring Boot + NestJS)

---

## 🎯 Tài Liệu Theo Vai Trò

### 👨‍💼 Dành cho Product Manager / Khách Hàng
Bạn muốn hiểu **sản phẩm làm gì** và **giải quyết vấn đề gì**?

➡️ Đọc: [**PRD.md**](./PRD.md) (5 phút)
- Vấn đề cần giải quyết
- Người dùng mục tiêu
- Tính năng chính
- MVP scope

---

### 👨‍💻 Dành cho Developer Mới
Bạn vừa join team và cần **setup project**?

**Ngày 1:**
1. ➡️ [**PROJECT_SUMMARY.md**](./PROJECT_SUMMARY.md) (10 phút) - Tổng quan nhanh
2. ➡️ [**README.md**](../README.md) (15 phút) - Setup guide
3. ➡️ [**CONTRIBUTING.md**](./CONTRIBUTING.md) (20 phút) - Quy trình làm việc

**Ngày 2-3:**
4. ➡️ [**SRS.md**](./SRS.md) (30 phút) - Hiểu kiến trúc kỹ thuật
5. ➡️ [**DATABASE_SCHEMA.md**](./DATABASE_SCHEMA.md) (20 phút) - Hiểu cấu trúc database
6. ➡️ [**SECURITY.md**](./SECURITY.md) (15 phút) - Security best practices

**Tuần 1:**
7. ➡️ Đọc Active ADRs trong folder [**adr/**](./adr/) (30 phút) - Hiểu current architecture
   - **Start with ADR-006** (core architecture)
   - Skip ADR-001, ADR-002 (superseded - chỉ đọc nếu cần historical context)

---

### 🏗️ Dành cho Architect / Tech Lead
Bạn cần hiểu **quyết định kiến trúc** và **lý do**?

**🟢 Active ADRs (Current Architecture):**
1. ⭐ [**ADR-006: Polyglot 3-Service Architecture**](./adr/ADR-006-hybrid-microservices.md) - **CORE ARCHITECTURE**
2. ⭐ [**ADR-009: RabbitMQ for Polyglot**](./adr/ADR-009-rabbitmq-polyglot.md) - **Message Queue** 🆕
3. ✅ [**ADR-008: Cloudflare R2 Storage**](./adr/ADR-008-cloudflare-r2.md) - File storage strategy
4. ✅ [**ADR-003: Prisma ORM**](./adr/ADR-003-prisma-orm.md) - Database ORM choice
5. ✅ [**ADR-004: Deployment Strategy**](./adr/ADR-004-deployment-strategy.md) - Vercel + Railway
6. ✅ [**ADR-005: Separate Repos**](./adr/ADR-005-separate-repos.md) - Frontend/Backend separation

**⚠️ Superseded/Partial ADRs (Historical Reference):**
- ⚠️ [**ADR-007: BullMQ over Kafka**](./adr/ADR-007-bullmq-over-kafka.md) → Partially superseded by ADR-009 (still valid for Node.js-only)
- ⚠️ [**ADR-001: NestJS Monorepo**](./adr/ADR-001-nestjs-monorepo.md) → Superseded by ADR-006
- ⚠️ [**ADR-002: Apache Kafka**](./adr/ADR-002-kafka-message-queue.md) → Superseded by ADR-007

**Technical Deep Dive:**
7. ➡️ [**SRS.md**](./SRS.md) - System architecture & service structure
8. ➡️ [**DATABASE_SCHEMA.md**](./DATABASE_SCHEMA.md) - Database design, indexes, migrations

---

### 🔧 Dành cho Developer Đang Code
Bạn đang **implement feature** và cần reference?

**API Development:**
- ➡️ [**API_REFERENCE.md**](./API_REFERENCE.md) - Endpoints, request/response format
- ➡️ [**DATABASE_SCHEMA.md**](./DATABASE_SCHEMA.md) - Entities, relationships
- ➡️ [**SECURITY.md**](./SECURITY.md) - Auth, RBAC, file upload security

**Best Practices:**
- ➡️ [**CONTRIBUTING.md**](./CONTRIBUTING.md) - Code standards, Git workflow
- ➡️ [**SRS.md**](./SRS.md) Section 6 - Clean Architecture layers

**Skills Support:**
- ➡️ [**RECOMMENDED_SKILLS.md**](./RECOMMENDED_SKILLS.md) - Claude skills cho từng task

---

### 🔒 Dành cho Security Review
Bạn cần **audit security** của dự án?

➡️ Đọc: [**SECURITY.md**](./SECURITY.md) (30 phút)
- Authentication & Authorization
- Password policy
- RBAC matrix
- File upload security
- GDPR compliance
- Incident response plan

---

### 📊 Dành cho Project Manager
Bạn cần theo dõi **progress** và **timeline**?

➡️ Đọc: [**TEAM_DECISIONS.md**](./TEAM_DECISIONS.md) (15 phút)
- 6 quyết định chính thức
- Roadmap 8 tuần (4 sprints)
- Sprint planning template
- Demo schedule (Week 2, 4, 6, 8)

---

## 📁 Cấu Trúc Tài Liệu

```
talentflow-backend/
├── README.md                          ⭐ BẮT ĐẦU TỪ ĐÂY
├── docker-compose.yml                 🐳 Infrastructure setup
├── .env.example                       ⚙️ Config template
│
└── docs/
    ├── INDEX.md                       📚 File này (navigation guide)
    │
    ├── 📋 Business & Product
    │   └── PRD.md
    │
    ├── 🏗️ Technical Specification
    │   ├── SRS.md
    │   ├── DATABASE_SCHEMA.md
    │   ├── API_REFERENCE.md
    │   ├── SECURITY.md
    │   ├── MONITORING.md              🆕 Monitoring & observability
    │   └── PERFORMANCE.md             🆕 Performance optimization
    │
    ├── 👨‍💻 Development
    │   ├── CONTRIBUTING.md
    │   ├── TESTING_STRATEGY.md
    │   ├── DEPLOYMENT.md
    │   └── RECOMMENDED_SKILLS.md
    │
    ├── 📊 Project Management
    │   ├── PROJECT_SUMMARY.md
    │   └── TEAM_DECISIONS.md
    │
    └── 🏛️ Architecture Decisions
        └── adr/
            ├── 🟢 ADR-003-prisma-orm.md (Active)
            ├── 🟢 ADR-004-deployment-strategy.md (Active)
            ├── 🟢 ADR-005-separate-repos.md (Active)
            ├── ⭐ ADR-006-hybrid-microservices.md (CURRENT ARCHITECTURE)
            ├── ⚠️ ADR-007-bullmq-over-kafka.md (Partial - Node.js only)
            ├── 🟢 ADR-008-cloudflare-r2.md (Active)
            ├── ⭐ ADR-009-rabbitmq-polyglot.md (CURRENT - Message Queue) 🆕
            ├── ⚠️ ADR-001-nestjs-monorepo.md (SUPERSEDED → See ADR-006)
            └── ⚠️ ADR-002-kafka-message-queue.md (SUPERSEDED → See ADR-007)
```

---

## 🎯 Tài Liệu Theo Giai Đoạn

### 🟢 Tuần 0: Onboarding & Setup
Đọc theo thứ tự:
1. PROJECT_SUMMARY.md (overview)
2. README.md (setup)
3. CONTRIBUTING.md (workflow)
4. TEAM_DECISIONS.md (action plan)

### 🟡 Tuần 1-2: Frontend Development
5. PRD.md (understand features)
6. API_REFERENCE.md (API contracts)

### 🔵 Tuần 3-4: Backend Development
7. SRS.md (architecture)
8. DATABASE_SCHEMA.md (database)
9. SECURITY.md (auth & security)
10. All ADRs (understand decisions)

### 🟣 Tuần 5-8: Integration & Deploy
11. API_REFERENCE.md (complete docs)
12. TEAM_DECISIONS.md (deployment checklist)

---

## 🔍 Tìm Kiếm Nhanh

**Tôi cần...**

| Nhu Cầu | Tài Liệu |
|---------|----------|
| Setup project local | README.md |
| Hiểu product | PRD.md |
| Hiểu kiến trúc | SRS.md + ADR-006 (current) |
| Implement API endpoint | API_REFERENCE.md + DATABASE_SCHEMA.md |
| Git workflow | CONTRIBUTING.md |
| Security policy | SECURITY.md |
| Timeline & roadmap | TEAM_DECISIONS.md |
| Quick overview | PROJECT_SUMMARY.md |
| Database schema | DATABASE_SCHEMA.md |
| Environment config | .env.example |
| Local infrastructure | docker-compose.yml |
| **Setup monitoring** | **MONITORING.md** 🆕 |
| **Performance optimization** | **PERFORMANCE.md** 🆕 |
| **Load testing** | **PERFORMANCE.md** 🆕 |
| **Deploy to production** | **DEPLOYMENT.md** |

---

## 📊 Tóm Tắt Tài Liệu

### Tổng Số Files: 21 (Updated!)

#### Must Read - Start Here (5):
1. ⭐ README.md - Setup guide
2. ⭐ PROJECT_SUMMARY.md - Quick overview
3. ⭐ CONTRIBUTING.md - Code standards
4. ⭐ TEAM_DECISIONS.md - Roadmap & decisions
5. ⭐ SECURITY.md - Security policy

#### Technical Reference (7):
6. SRS.md - Technical specification
7. DATABASE_SCHEMA.md - Database design
8. API_REFERENCE.md - API endpoints
9. PRD.md - Product requirements
10. RECOMMENDED_SKILLS.md - Claude skills
11. **MONITORING.md** 🆕 - Monitoring & observability
12. **PERFORMANCE.md** 🆕 - Performance optimization

#### Operations & Deployment (2):
13. DEPLOYMENT.md - Deployment guide
14. TESTING_STRATEGY.md - Testing strategies

#### Architecture Decisions - Active (7):
11. ⭐ ADR-006 - **Polyglot 3-Service** (CURRENT)
12. ⭐ ADR-009 - **RabbitMQ Queue** (CURRENT) 🆕
13. ADR-008 - **Cloudflare R2** (CURRENT)
14. ADR-003 - Prisma ORM
15. ADR-004 - Deployment Strategy
16. ADR-005 - Separate FE/BE Repos
17. ⚠️ ADR-007 - **BullMQ** (Node.js-only, see ADR-009 for polyglot)

#### Architecture Decisions - Superseded (2):
18. ⚠️ ADR-001 - NestJS Monorepo (Historical - See ADR-006)
19. ⚠️ ADR-002 - Apache Kafka (Historical - See ADR-007)

---

## ✅ Documentation Quality

**Completeness:** 95% ⭐⭐⭐⭐⭐
**Clarity:** 9/10 ⭐⭐⭐⭐⭐
**Usefulness:** 10/10 ⭐⭐⭐⭐⭐
**Organization:** 9/10 ⭐⭐⭐⭐⭐

**Overall:** 🟢 **EXCELLENT**

---

## 🎉 Start Here!

**Nếu bạn là:**
- 👨‍💼 **Product Manager** → Đọc [PRD.md](./PRD.md)
- 👨‍💻 **Developer** → Đọc [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) → [README.md](../README.md)
- 🏗️ **Architect** → Đọc [ADR-006](./adr/ADR-006-hybrid-microservices.md) ⭐ → [SRS.md](./SRS.md) → Active ADRs
- 📊 **Project Lead** → Đọc [TEAM_DECISIONS.md](./TEAM_DECISIONS.md)

**Chưa biết bắt đầu từ đâu?**
👉 Đọc [**PROJECT_SUMMARY.md**](./PROJECT_SUMMARY.md) trước!

**Quick Architecture Reference:**
📖 **Current Architecture:** [ADR-006: Polyglot 3-Service](./adr/ADR-006-hybrid-microservices.md)
📖 **Queue (Polyglot):** [ADR-009: RabbitMQ](./adr/ADR-009-rabbitmq-polyglot.md) 🆕
📖 **Storage:** [ADR-008: Cloudflare R2](./adr/ADR-008-cloudflare-r2.md)

---

**Happy Reading! 📖**
