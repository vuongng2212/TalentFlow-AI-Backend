# Smart ATS Task Breakdown

**Project:** TalentFlow AI Backend  
**Scope:** Post-MVP Smart ATS expansion execution checklist  
**Status:** Ready for task assignment  
**Last Updated:** 2026-04-06

---

## How to use this document

Tài liệu này dùng để:
- drop task cho member mới
- theo dõi dependency giữa các module
- tick checklist khi hoàn thành từng phần
- giữ đồng bộ giữa workspace, billing, ingestion và entitlement

---

## Phase 0 — Foundation / Cross-cutting

### Task 0.1 — Chốt naming và phạm vi workspace domain
- [ ] Xác định dùng `Workspace`, `Organization`, hay tách cả 2 khái niệm
- [ ] Chốt workspace có đại diện cho board dùng chung hay chỉ là billing owner
- [ ] Chốt quan hệ giữa `User`, `Workspace`, `WorkspaceMember`
- [ ] Cập nhật domain glossary trong docs

**Deliverables:**
- naming decision note
- updated domain glossary

### Task 0.2 — Chốt enum và lifecycle chính
- [ ] Chốt `SubscriptionStatus`
- [ ] Chốt `PaymentTransactionStatus`
- [ ] Chốt `IngestionEventStatus`
- [ ] Chốt các transition hợp lệ cho callback, retry, expire

**Deliverables:**
- enum draft
- state transition note

### Task 0.3 — Chốt security baseline cho expansion modules
- [ ] Quyết định auth cho n8n endpoint: API key, signature, hoặc cả hai
- [ ] Chốt nguyên tắc verify callback từ Momo
- [ ] Chốt giới hạn file type / file size / retry policy
- [ ] Chốt yêu cầu idempotency cho payment callback và ingestion retry

**Deliverables:**
- security checklist cho ingestion + payment

---

## Phase 1 — Workspace / Membership

### Task 1.1 — Draft Prisma schema cho workspace domain
- [ ] Draft `Workspace`
- [ ] Draft `WorkspaceMember`
- [ ] Xác định role nội bộ: owner/admin/recruiter/viewer nếu cần
- [ ] Xác định unique constraints và membership status

**Dependencies:** Task 0.1  
**Deliverables:** schema draft + relationship notes

### Task 1.2 — Thiết kế access model
- [ ] Xác định ai được tạo workspace
- [ ] Xác định ai được mời member
- [ ] Xác định ai được mua gói và đổi plan
- [ ] Xác định quyền của recruiter trong cùng board/workspace

**Dependencies:** Task 1.1  
**Deliverables:** permission matrix

### Task 1.3 — Xác định impact lên ATS core hiện tại
- [ ] Xác định `Job` sẽ gắn `workspaceId` như thế nào
- [ ] Xác định `Application` và `Candidate` đi theo workspace trực tiếp hay gián tiếp qua `Job`
- [ ] Xác định migration direction từ schema hiện tại sang schema mở rộng
- [ ] Ghi rõ các điểm cần refactor trong ATS core

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

### Task 2.2 — Thiết kế Momo checkout flow chi tiết
- [ ] Xác định endpoint tạo checkout session
- [ ] Xác định payload gửi sang Momo
- [ ] Xác định redirect URL / return URL / callback URL
- [ ] Xác định mapping giữa provider reference và transaction nội bộ

**Dependencies:** Task 2.1, Task 0.3  
**Deliverables:** API contract draft + provider mapping note

### Task 2.3 — Thiết kế callback / reconciliation handling
- [ ] Xác định verify signature
- [ ] Xác định cơ chế idempotency cho callback retry
- [ ] Xác định xử lý `SUCCESS`, `FAILED`, `EXPIRED`, `CANCELLED`, `REFUNDED` nếu có
- [ ] Xác định job reconciliation khi callback bị trễ hoặc mất

**Dependencies:** Task 2.2  
**Deliverables:** callback handling design + retry/idempotency strategy

### Task 2.4 — Thiết kế entitlement source of truth
- [ ] Chốt `Subscription` hay `SubscriptionPlan + cached entitlement snapshot` là nguồn quyết định quyền
- [ ] Xác định cách tính quota theo chu kỳ
- [ ] Xác định cách reset usage cho kỳ mới
- [ ] Xác định chính sách downgrade / upgrade giữa kỳ

**Dependencies:** Task 2.1  
**Deliverables:** entitlement calculation note

---

## Phase 3 — Automation / Ingestion

### Task 3.1 — Draft ingestion schema
- [ ] Draft `JobIngestionRule`
- [ ] Draft `IngestionEvent`
- [ ] Xác định các trường cần cho duplicate detection
- [ ] Xác định audit trail fields cho email source

**Dependencies:** Task 0.2, Task 1.1  
**Deliverables:** schema draft + idempotency field proposal

### Task 3.2 — Thiết kế subject mapping strategy
- [ ] Chốt pattern mapping: exact tag, normalized tag, hay configurable regex
- [ ] Chốt fallback khi không map được `jobId`
- [ ] Chốt cách quản lý rule theo workspace
- [ ] Xác định convention cho subject tags phía business

**Dependencies:** Task 3.1  
**Deliverables:** mapping strategy note

### Task 3.3 — Draft ingestion API contract
- [ ] Thiết kế protected endpoint cho n8n
- [ ] Xác định request payload, metadata, attachment handling
- [ ] Xác định response shape cho success, duplicate, invalid rule, invalid file
- [ ] Xác định auth headers / signature fields cho automation source

**Dependencies:** Task 0.3, Task 3.1, Task 3.2  
**Deliverables:** planned API spec

### Task 3.4 — Define duplicate prevention strategy
- [ ] Chốt idempotency key từ `externalMessageId`, attachment fingerprint, hoặc combination key
- [ ] Xác định khi nào create mới candidate/application và khi nào reject duplicate
- [ ] Xác định policy cho retries từ n8n
- [ ] Xác định audit logging cho duplicate events

**Dependencies:** Task 3.1, Task 3.3  
**Deliverables:** duplicate handling policy

### Task 3.5 — Define reuse points from current pipeline
- [ ] Chỉ rõ logic nào tái sử dụng từ `ApplicationsService`
- [ ] Chỉ rõ logic nào tái sử dụng từ `StorageService`
- [ ] Chỉ rõ event publish nào phải giữ nguyên để CV Parser không bị ảnh hưởng
- [ ] Chỉ rõ phần nào cần extract thành shared internal service

**Dependencies:** Task 3.3  
**Deliverables:** integration notes with existing services

---

## Phase 4 — Entitlement / Feature Gating

### Task 4.1 — Liệt kê feature gates
- [ ] Xác định feature nào bị khóa theo plan
- [ ] Xác định feature nào tính theo quota
- [ ] Xác định feature nào chỉ hiện ở enterprise tiers
- [ ] Xác định feature nào áp dụng ở workspace level vs member level

**Dependencies:** Task 2.4  
**Deliverables:** feature gate matrix

### Task 4.2 — Xác định enforcement points
- [ ] Chốt các endpoint cần entitlement check
- [ ] Chốt enforcement tại controller, service, hay guard
- [ ] Xác định các action bị chặn: tạo job, bật automation, parse CV, mời thêm recruiter
- [ ] Xác định cách trả lỗi khi workspace vượt quota hoặc không đủ quyền

**Dependencies:** Task 4.1, Task 1.2, Task 3.3  
**Deliverables:** enforcement map

### Task 4.3 — Define usage tracking strategy
- [ ] Xác định đếm usage ở đâu
- [ ] Xác định update usage theo synchronous flow hay async event
- [ ] Xác định cơ chế reset usage theo billing cycle
- [ ] Xác định chính sách backfill usage nếu event bị lỗi

**Dependencies:** Task 2.4, Task 4.1  
**Deliverables:** usage tracking note

---

## Phase 5 — Testing & Verification

### Task 5.1 — Billing verification plan
- [ ] Test checkout creation
- [ ] Test callback success
- [ ] Test callback failure / expired
- [ ] Test callback retry idempotency
- [ ] Test subscription activation / cancellation

### Task 5.2 — Ingestion verification plan
- [ ] Test subject mapping đúng job
- [ ] Test invalid subject / missing rule
- [ ] Test duplicate email retry
- [ ] Test invalid file type / oversized file
- [ ] Test publish đúng `cv.uploaded`

### Task 5.3 — Entitlement verification plan
- [ ] Test workspace đúng plan được tạo job
- [ ] Test workspace vượt quota bị chặn
- [ ] Test recruiter invite limit theo plan
- [ ] Test automation chỉ bật được khi plan hỗ trợ

---

## Suggested assignment by member

### Member A — Workspace / Membership
- [ ] Task 0.1
- [ ] Task 1.1
- [ ] Task 1.2
- [ ] Task 1.3

### Member B — Billing / Payment
- [ ] Task 0.2
- [ ] Task 2.1
- [ ] Task 2.2
- [ ] Task 2.3
- [ ] Task 2.4
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
- [ ] Task 4.1
- [ ] Task 4.2
- [ ] Task 4.3
- [ ] Task 5.3
- [ ] Review dependency giữa workspace, billing, ingestion

---

## Suggested execution order
- [ ] Task 0.1 → 0.3
- [ ] Task 1.1 → 1.3
- [ ] Task 2.1 → 2.4 song song với Task 3.1 → 3.5
- [ ] Task 4.1 → 4.3 sau khi billing và ingestion rõ contract
- [ ] Task 5.1 → 5.3 để chốt verification matrix trước khi code

---

## Ready-to-drop first wave

### Wave 1
- [ ] Task 0.1
- [ ] Task 0.2
- [ ] Task 0.3
- [ ] Task 1.1
- [ ] Task 2.1
- [ ] Task 3.1

### Wave 2
- [ ] Task 1.2
- [ ] Task 1.3
- [ ] Task 2.2
- [ ] Task 2.3
- [ ] Task 3.2
- [ ] Task 3.3

### Wave 3
- [ ] Task 2.4
- [ ] Task 3.4
- [ ] Task 3.5
- [ ] Task 4.1
- [ ] Task 4.2
- [ ] Task 4.3

### Wave 4
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
