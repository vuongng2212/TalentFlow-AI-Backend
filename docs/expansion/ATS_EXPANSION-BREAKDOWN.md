# Smart ATS Task Breakdown (Expansion-aligned)

**Project:** TalentFlow AI Backend  
**Scope:** Payment + Subscription + Entitlement + Workspace/Automation alignment  
**Status:** Ready for assignment (decision-locked)  
**Last Updated:** 2026-04-12

---

## Sources aligned

- `docs/payment/SMART_ATS_EXPANSION.md` (single source of truth)
- `docs/payment/SMART_ATS_TASK_BREAKDOWN.md` (execution checklist)

---

## A) Decision Lock (đã chốt)

1. **Priority khi user có cả Plus và Business (AI evaluation)**
   - Dùng **quota Plus trước**, hết mới dùng quota Business (workspace).

2. **Counter độc lập**
   - `CV_UPLOAD_DAILY`, `AI_EVAL_DAILY` và `INTERVIEW_SCHEDULE_DAILY` là 3 metric độc lập.

3. **Quota reset policy**
   - Reset theo **UTC day**.
   - Hiển thị theo **user timezone** ở presentation layer.

4. **Interview schedule quota policy**
   - Free (personal): tối đa **1/ngày/user**.
   - Plus (personal): tối đa **10/ngày/user**.
   - Business (workspace): dùng **shared workspace pool 500/ngày/workspace**.

5. **Job và Workspace không có relationship**
   - Không tồn tại quan hệ trực tiếp/gián tiếp giữa Job và Workspace.

---

## B) Product scope (implementation baseline)

### Free (personal)

- Candidate: upload CV tối đa **5/ngày**, chỉ xem **điểm tổng** AI.
- HR: AI evaluation tối đa **5/ngày**, chỉ xem **điểm tổng** AI.
- Interviewer + HR + Recruiter: tạo interview schedule tối đa **1/ngày/user**.

### Plus (personal)

- Candidate: upload CV tối đa **50/ngày**, có **ưu/nhược điểm + advice**.
- HR: AI evaluation tối đa **50/ngày**, có breakdown theo từng phần + lý do chấm.
- Interviewer + HR + Recruiter: tạo interview schedule tối đa **10/ngày/user**.

### Business (workspace)

- Có workspace, tối đa **50 members/workspace** (email có sẵn trong hệ thống).
- Member hưởng feature tương đương Plus.
- Quota AI evaluation cấp workspace: **500/ngày/workspace** (shared pool).
- Quota interview schedule cấp workspace: **500/ngày/workspace** (shared pool).

---

## C) Entitlement matrix (để dev/test bám trực tiếp)

| Capability                  |   Free |    Plus |                                Business |
| --------------------------- | -----: | ------: | --------------------------------------: |
| Scope                       |   User |    User |                      Workspace + Member |
| CV uploads/day              | 5/user | 50/user |     Theo member policy (metric độc lập) |
| AI evaluations/day          | 5/user | 50/user | 500/workspace/day + Plus-first fallback |
| Interview schedules/day     | 1/user | 10/user |         500/workspace/day (shared pool) |
| Chỉ điểm tổng               |     ✅ |      ✅ |                                      ✅ |
| Ưu/nhược điểm + advice      |     ❌ |      ✅ |                                      ✅ |
| Breakdown theo phần + lý do |     ❌ |      ✅ |                                      ✅ |
| Workspace enabled           |     ❌ |      ❌ |                                      ✅ |
| Max members/workspace       |      - |       - |                                      50 |

### Rule engine bắt buộc cho Business member (AI evaluation)

1. Consume Plus user quota trước (nếu còn).
2. Hết Plus mới consume Business workspace quota.
3. Hết cả hai -> `QUOTA_EXCEEDED`.

### Rule engine cho Interview schedule (NEW)

1. Personal plan: consume theo `INTERVIEW_SCHEDULE_DAILY` của user.
2. Business member: consume từ shared workspace pool `INTERVIEW_SCHEDULE_DAILY`.
3. Hết quota -> `QUOTA_EXCEEDED`.
4. Role tạo schedule: `INTERVIEWER`, `HR`, `RECRUITER`.

---

## D) How to use this document

Tài liệu này dùng để:

- drop task cho member mới
- theo dõi dependency giữa module
- tick checklist khi hoàn thành
- giữ đồng bộ giữa billing, entitlement, workspace, ingestion

---

## Phase 0 — Foundation / Cross-cutting

### Task 0.1 — Chốt naming và phạm vi workspace domain

- [x] Xác định dùng `Workspace`, `Organization`, hay tách cả 2 khái niệm
- [x] Chốt workspace là board dùng chung + billing owner hay tách role
- [x] Chốt quan hệ giữa `User`, `Workspace`, `WorkspaceMember`
- [x] Cập nhật domain glossary trong docs

**Deliverables:**

- [x] naming decision note
- [x] updated domain glossary

### Task 0.2 — Chốt enum và lifecycle chính

- [x] Chốt `SubscriptionStatus`
- [x] Chốt `PaymentTransactionStatus`
- [x] Chốt `IngestionEventStatus`
- [x] Chốt transition hợp lệ cho callback, retry, expire

**Deliverables:**

- [x] enum draft
- [x] state transition note

### Task 0.3 — Chốt security baseline cho expansion modules

- [x] Quyết định auth cho n8n endpoint: API key, signature, hoặc cả hai
- [x] Chốt nguyên tắc verify callback từ Momo
- [x] Chốt giới hạn file type / file size / retry policy
- [x] Chốt idempotency cho payment callback và ingestion retry

**Deliverables:**

- [x] security checklist cho ingestion + payment

### Task 0.4 — Chốt quota policy runtime (NEW)

- [x] Ghi rule **Plus-first rồi Business fallback** vào policy spec
- [x] Chốt rõ 3 metric độc lập: upload vs evaluation vs interview schedule
- [x] Chốt UTC reset + timezone display convention
- [x] Chốt error codes khi vượt quota

**Dependencies:** Task 0.2  
**Deliverables:** [x] quota policy note + [x] error contract

---

## Phase 1 — Workspace / Membership

### Task 1.1 — Draft Prisma schema cho workspace domain

- [x] Draft `Workspace`
- [x] Draft `WorkspaceMember`
- [x] Xác định role nội bộ: owner/admin/recruiter/viewer nếu cần
- [x] Xác định unique constraints và membership status

**Dependencies:** Task 0.1  
**Deliverables:** schema draft + relationship notes

### Task 1.2 — Thiết kế access model

- [x] Xác định ai được tạo workspace
- [x] Xác định ai được mời member
- [ ] Xác định ai được mua gói và đổi plan
- [x] Xác định quyền recruiter trong cùng board/workspace

**Dependencies:** Task 1.1  
**Deliverables:** permission matrix

### Task 1.3 — Enforce workspace member cap (NEW)

- [x] Enforce max 50 active members/workspace
- [x] Validate member email phải tồn tại trong hệ thống
- [x] Chặn add member nếu plan không phải Business active

**Dependencies:** Task 1.1, Task 2.4  
**Deliverables:** membership constraint spec + test cases

### Task 1.4 — Xác định impact lên ATS core hiện tại

- [x] Khẳng định `Job` và `Workspace` không có relationship trực tiếp/gián tiếp
- [x] Xác định `Application`/`Candidate` đi theo `Job` và ownership domain đã chốt (không suy diễn qua workspace)
- [x] Xác định migration direction từ schema hiện tại sang schema mở rộng
- [x] Ghi rõ điểm cần refactor trong ATS core

**Dependencies:** Task 1.1  
**Deliverables:** migration notes

---

## Phase 2 — Billing / Payment

### Task 2.1 — Draft billing schema

- [ ] Draft `SubscriptionPlan`
- [ ] Draft `Subscription`
- [ ] Draft `PaymentTransaction`
- [ ] Xác định plan features, usage limits, billing cycle
- [ ] Xác định link giữa `Workspace` và `Subscription`

**Dependencies:** Task 0.1, Task 0.2, Task 1.1  
**Deliverables:** schema draft + lifecycle fields

### Task 2.2 — Seed và chuẩn hóa 3 plans (NEW)

- [ ] Seed `FREE`, `PLUS`, `BUSINESS`
- [ ] Encode limits đúng theo scope đã chốt
- [ ] Encode feature flags (score-only vs full-analysis)
- [ ] Encode `INTERVIEW_SCHEDULE_DAILY` limits (Free: 1/user/day, Plus: 10/user/day, Business: 500/workspace/day shared pool)
- [ ] Version hóa plan config để dễ audit thay đổi

**Dependencies:** Task 2.1  
**Deliverables:** seed script + plan config table

### Task 2.3 — Thiết kế Momo checkout flow chi tiết

- [ ] Xác định endpoint tạo checkout session
- [ ] Xác định payload gửi sang Momo
- [ ] Xác định redirect URL / return URL / callback URL
- [ ] Xác định mapping giữa provider reference và transaction nội bộ

**Dependencies:** Task 2.1, Task 0.3  
**Deliverables:** API contract draft + provider mapping note

### Task 2.4 — Thiết kế callback / reconciliation handling

- [ ] Xác định verify signature
- [ ] Xác định idempotency cho callback retry
- [ ] Xác định xử lý `SUCCESS`, `FAILED`, `EXPIRED`, `CANCELLED`, `REFUNDED`
- [ ] Xác định reconciliation job khi callback trễ/mất

**Dependencies:** Task 2.3  
**Deliverables:** callback handling design + retry/idempotency strategy

### Task 2.5 — Thiết kế entitlement source of truth

- [ ] Chốt source of truth: active subscription + plan limits + usage counters
- [ ] Chốt cách tính quota theo UTC window
- [ ] Chốt downgrade / upgrade policy giữa kỳ
- [ ] Chốt mapping personal vs workspace ownership
- [ ] Chốt entitlement cho `INTERVIEW_SCHEDULE_DAILY` (personal theo user, business theo workspace shared pool)
- [ ] Chốt role được tạo interview schedule: `INTERVIEWER`, `HR`, `RECRUITER`

**Dependencies:** Task 2.1, Task 0.4  
**Deliverables:** entitlement calculation note

---

## Phase 3 — Automation / Ingestion

*Tài liệu kiến trúc và lộ trình thực tế:* [email-ingestion-automation.md](docs/expansion/email-ingestion-automation.md)

### Task 3.1 — Draft ingestion schema

- [ ] Draft `JobIngestionRule`
- [ ] Draft `IngestionEvent`
- [ ] Xác định fields cho duplicate detection
- [ ] Xác định audit trail fields cho email source

**Dependencies:** Task 0.2, Task 1.1  
**Deliverables:** schema draft + idempotency field proposal

### Task 3.2 — Thiết kế subject mapping strategy

- [ ] Chốt pattern mapping: exact/normalized/configurable regex
- [ ] Chốt fallback khi không map được `jobId`
- [ ] Chốt cách quản lý rule theo owner domain đã chốt (không theo workspace)
- [ ] Xác định convention subject tags phía business

**Dependencies:** Task 3.1  
**Deliverables:** mapping strategy note

### Task 3.3 — Draft ingestion API contract

- [ ] Thiết kế protected endpoint cho n8n
- [ ] Xác định payload, metadata, attachment handling
- [ ] Xác định response shape cho success/duplicate/invalid-rule/invalid-file
- [ ] Xác định auth headers/signature fields

**Dependencies:** Task 0.3, Task 3.1, Task 3.2  
**Deliverables:** planned API spec

### Task 3.4 — Define duplicate prevention strategy

- [ ] Chốt idempotency key (`externalMessageId` + fingerprint...)
- [ ] Xác định khi nào create mới candidate/application và khi nào reject duplicate
- [ ] Xác định retry policy từ n8n
- [ ] Xác định audit logging cho duplicate events

**Dependencies:** Task 3.1, Task 3.3  
**Deliverables:** duplicate handling policy

### Task 3.5 — Define reuse points from current pipeline

- [ ] Chỉ rõ logic tái sử dụng từ `ApplicationsService`
- [ ] Chỉ rõ logic tái sử dụng từ `StorageService`
- [ ] Chỉ rõ event publish phải giữ nguyên để CV Parser không bị ảnh hưởng
- [ ] Chỉ rõ phần cần extract thành shared internal service

**Dependencies:** Task 3.3  
**Deliverables:** integration notes with existing services

---

## Phase 4 — Entitlement / Feature Gating

### Task 4.1 — Liệt kê feature gates

- [ ] Xác định feature bị khóa theo plan
- [ ] Xác định feature tính theo quota
- [ ] Xác định feature chỉ hiện ở enterprise tiers
- [ ] Xác định feature áp dụng workspace level vs member level
- [ ] Xác định gate cho tạo interview schedule theo `INTERVIEW_SCHEDULE_DAILY`
- [ ] Xác định role gate cho tạo interview schedule: `INTERVIEWER`, `HR`, `RECRUITER`

**Dependencies:** Task 2.5  
**Deliverables:** feature gate matrix

### Task 4.2 — Xác định enforcement points

- [ ] Chốt endpoint cần entitlement check
- [ ] Chốt enforcement tại controller/service/guard
- [ ] Xác định action bị chặn: tạo job, bật automation, parse CV, mời recruiter, tạo interview schedule
- [ ] Xác định cách trả lỗi khi vượt quota/không đủ quyền

**Dependencies:** Task 4.1, Task 1.2, Task 3.3  
**Deliverables:** enforcement map

### Task 4.3 — Define usage tracking strategy

- [ ] Xác định đếm usage ở đâu
- [ ] Xác định sync hay async update usage
- [ ] Xác định reset usage theo UTC
- [ ] Xác định backfill usage nếu event lỗi
- [ ] Xác định tracking cho `INTERVIEW_SCHEDULE_DAILY` (personal theo user, business theo shared workspace pool)

**Dependencies:** Task 2.5, Task 4.1  
**Deliverables:** usage tracking note

### Task 4.4 — Implement priority policy checks (NEW)

- [ ] Implement rule: Plus-first -> Business fallback (AI evaluation)
- [ ] Guarantee 3 counter độc lập không consume chéo (`CV_UPLOAD_DAILY`, `AI_EVAL_DAILY`, `INTERVIEW_SCHEDULE_DAILY`)
- [ ] Add idempotent consume API cho quota
- [ ] Add telemetry cho quota reject và fallback rate

**Dependencies:** Task 0.4, Task 4.3  
**Deliverables:** policy module spec + metric definitions

---

## Phase 5 — Testing & Verification

### Task 5.1 — Billing verification plan

- [ ] Test checkout creation
- [ ] Test callback success
- [ ] Test callback failure/expired
- [ ] Test callback retry idempotency
- [ ] Test subscription activation/cancellation

### Task 5.2 — Ingestion verification plan

- [ ] Test subject mapping đúng job
- [ ] Test invalid subject/missing rule
- [ ] Test duplicate email retry
- [ ] Test invalid file type/oversized file
- [ ] Test publish đúng `cv.uploaded`

### Task 5.3 — Entitlement verification plan

- [ ] Test Free/Plus quota đúng ngưỡng
- [ ] Test Business workspace quota 500/day
- [ ] Test member cap 50/workspace
- [ ] Test Plus-first rồi mới Business fallback (AI evaluation)
- [ ] Test interview schedule quota: Free 1/day, Plus 10/day, Business 500/workspace/day shared pool
- [ ] Test role tạo schedule: `INTERVIEWER`, `HR`, `RECRUITER`
- [ ] Test 3 counter độc lập (upload không ảnh hưởng eval/schedule)
- [ ] Test UTC day rollover + timezone display

---

## Suggested assignment by member

### Member A — Workspace / Membership

- [ ] Task 0.1
- [x] Task 1.1
- [ ] Task 1.2
- [x] Task 1.3
- [x] Task 1.4

### Member B — Billing / Payment

- [ ] Task 0.2
- [ ] Task 2.1
- [ ] Task 2.2
- [ ] Task 2.3
- [ ] Task 2.4
- [ ] Task 2.5
- [ ] Task 5.1

### Member C — Automation / Ingestion

- [ ] Task 0.3
- [ ] Task 3.1
- [ ] Task 3.2
- [ ] Task 3.3
- [ ] Task 3.4
- [ ] Task 3.5
- [ ] Task 5.2

### Member D — Entitlement / Integration

- [ ] Task 0.4
- [ ] Task 4.1
- [ ] Task 4.2
- [ ] Task 4.3
- [ ] Task 4.4
- [ ] Task 5.3
- [ ] Review dependency giữa workspace, billing, ingestion

---

## Suggested execution order

- [ ] Phase 0: Task 0.1 → 0.4
- [ ] Phase 1: Task 1.1 → 1.4
- [ ] Phase 2: Task 2.1 → 2.5
- [ ] Phase 3: Task 3.1 → 3.5 (song song với phần Phase 2 phù hợp)
- [ ] Phase 4: Task 4.1 → 4.4
- [ ] Phase 5: Task 5.1 → 5.3

---

## Ready-to-drop first wave

### Wave 1

- [ ] Task 0.1
- [ ] Task 0.2
- [ ] Task 0.3
- [ ] Task 0.4
- [x] Task 1.1
- [ ] Task 2.1

### Wave 2

- [ ] Task 2.2
- [ ] Task 2.3
- [ ] Task 2.4
- [ ] Task 1.2
- [ ] Task 3.1
- [ ] Task 3.2

### Wave 3

- [ ] Task 2.5
- [ ] Task 3.3
- [ ] Task 3.4
- [ ] Task 3.5
- [ ] Task 4.1
- [ ] Task 4.2

### Wave 4

- [x] Task 1.3
- [x] Task 1.4
- [ ] Task 4.3
- [ ] Task 4.4
- [ ] Task 5.1
- [ ] Task 5.2
- [ ] Task 5.3

---

## Related docs

- [SMART_ATS_EXPANSION.md](./SMART_ATS_EXPANSION.md)
- [TEAM_DECISIONS.md](./TEAM_DECISIONS.md)
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
