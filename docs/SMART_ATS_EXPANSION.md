# Smart ATS Expansion

**Project:** TalentFlow AI Backend  
**Scope:** Post-MVP expansion direction  
**Status:** Planned direction for team onboarding and task assignment  
**Payment Gateway Direction:** Momo is the planned primary payment gateway  
**Last Updated:** 2026-04-05

---

## Purpose

Tài liệu này tổng hợp định hướng mở rộng Smart ATS sau MVP để thành viên mới có thể nắm nhanh:
- bài toán sản phẩm đang mở rộng
- các module mới cần tách ra
- những gì có thể tái sử dụng từ hệ thống hiện tại
- các quyết định đã chốt và các điểm vẫn đang mở

---

## What is being added

### 1. Subscription / Package Registration
Hệ thống sẽ được mở rộng theo hướng bán gói Smart ATS cho khách hàng doanh nghiệp.

Mục tiêu:
- cho phép đăng ký gói dịch vụ
- tích hợp thanh toán
- kiểm soát entitlement theo từng gói
- hỗ trợ nhiều HR/Recruiter cùng dùng chung một board/workspace ở các gói cao hơn

### 2. Gmail + n8n CV Ingestion
Hệ thống sẽ hỗ trợ tự động lấy CV từ Gmail theo subject pattern gắn với JD, ví dụ:
- `[Java-Backend]`
- `[Frontend-ReactJs]`

Luồng mong muốn:
1. Gmail nhận email ứng viên
2. n8n lọc email theo rule
3. n8n tải attachment PDF/DOCX
4. n8n gọi API Gateway qua protected ingestion endpoint
5. API Gateway validate, resolve subject tag -> jobId, upload file, tạo application, publish `cv.uploaded`
6. CV Parser xử lý tiếp như flow hiện tại

---

## Domain & Schema Snapshot

Tài liệu hiện tại dùng hướng nhìn `Workspace/Organization-first` để giúp team thiết kế module enterprise nhất quán, dù schema production cuối cùng vẫn chưa chốt hoàn toàn.

```mermaid
erDiagram
    Workspace ||--o{ WorkspaceMember : has
    Workspace ||--o{ Job : owns
    Workspace ||--o{ JobIngestionRule : configures
    Workspace ||--o{ IngestionEvent : records
    Workspace ||--|| Subscription : has
    Subscription }o--|| SubscriptionPlan : uses
    Subscription ||--o{ PaymentTransaction : tracks
    Job ||--o{ Application : receives
    Candidate ||--o{ Application : submits
    JobIngestionRule ||--o{ IngestionEvent : matches
    IngestionEvent }o--|| Job : targets
    IngestionEvent }o--|| Candidate : creates_or_links
    IngestionEvent }o--|| Application : creates_or_links

    Workspace {
        uuid id PK
        string name
        string slug
        string status
    }

    WorkspaceMember {
        uuid id PK
        uuid workspaceId FK
        uuid userId FK
        string role
        string status
    }

    SubscriptionPlan {
        uuid id PK
        string code
        string name
        json featureFlags
        json usageLimits
    }

    Subscription {
        uuid id PK
        uuid workspaceId FK
        uuid planId FK
        string status
        datetime currentPeriodStart
        datetime currentPeriodEnd
    }

    PaymentTransaction {
        uuid id PK
        uuid subscriptionId FK
        string provider
        string providerRef
        string status
        decimal amount
    }

    JobIngestionRule {
        uuid id PK
        uuid workspaceId FK
        uuid jobId FK
        string subjectPattern
        string status
    }

    IngestionEvent {
        uuid id PK
        uuid workspaceId FK
        uuid jobId FK
        uuid ruleId FK
        string source
        string externalMessageId
        string status
    }

    Job {
        uuid id PK
        uuid workspaceId FK
        string title
        string status
    }

    Candidate {
        uuid id PK
        string email
        string fullName
    }

    Application {
        uuid id PK
        uuid jobId FK
        uuid candidateId FK
        string stage
        string status
    }
```

### Domain notes
- `Workspace` là chủ thể enterprise chính để gom board, jobs, members, automation rules và subscription.
- `SubscriptionPlan` định nghĩa feature flags và quota, còn `Subscription` là gói đang active của workspace.
- `PaymentTransaction` theo dõi vòng đời thanh toán qua Momo và các trạng thái callback/reconciliation.
- `JobIngestionRule` map subject tag hoặc email pattern sang `Job`.
- `IngestionEvent` phục vụ audit trail, duplicate detection và retry tracking cho n8n/Gmail ingestion.
- `Job`, `Application`, `Candidate` vẫn là ATS core entities và được nối vào domain mới thay vì bị thay thế.

---

## Momo Payment Flow Snapshot

Mục tiêu của flow này là mô tả một vòng đời thanh toán tối thiểu cho gói Smart ATS theo hướng `Workspace-first`.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Workspace Admin
    participant UI as Frontend / Portal
    participant API as API Gateway
    participant Billing as Billing Module
    participant DB as PostgreSQL
    participant Momo as Momo Gateway

    Admin->>UI: Chọn gói Smart ATS
    UI->>API: POST /subscriptions/checkout
    API->>Billing: Validate workspace + selected plan
    Billing->>DB: Create pending Subscription
    Billing->>DB: Create pending PaymentTransaction
    Billing->>Momo: Create payment request
    Momo-->>Billing: paymentUrl / deeplink / providerRef
    Billing-->>API: Checkout session data
    API-->>UI: Return paymentUrl
    UI->>Momo: Redirect user to payment page

    alt Payment success
        Momo-->>API: Callback / IPN payment success
        API->>Billing: Verify signature + providerRef
        Billing->>DB: Update PaymentTransaction = SUCCESS
        Billing->>DB: Activate or upgrade Subscription
        Billing->>DB: Refresh entitlement period / quotas
        API-->>Momo: Ack callback
        UI->>API: GET /subscriptions/current
        API-->>UI: Active subscription state
    else Payment failed or expired
        Momo-->>API: Callback / IPN failed or expired
        API->>Billing: Verify signature + providerRef
        Billing->>DB: Update PaymentTransaction = FAILED/EXPIRED
        Billing->>DB: Keep Subscription pending or inactive
        API-->>Momo: Ack callback
        UI->>API: GET /subscriptions/current
        API-->>UI: Pending or inactive subscription state
    end
```

### Payment flow notes
- `Subscription` nên được tạo ở trạng thái `PENDING` trước khi redirect sang Momo để giữ lifecycle rõ ràng.
- `PaymentTransaction` là nguồn sự thật cho trạng thái giao dịch với provider.
- callback/IPN từ Momo phải được verify chữ ký trước khi update dữ liệu.
- activation entitlement chỉ nên xảy ra sau khi giao dịch được xác nhận thành công.
- cần hỗ trợ các trạng thái `PENDING`, `SUCCESS`, `FAILED`, `EXPIRED`, và khả năng reconciliation nếu callback đến trễ hoặc bị retry.

---

## Billing State Machine Snapshot

### Subscription lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> ACTIVE: payment success
    PENDING --> EXPIRED: checkout timeout
    PENDING --> CANCELLED: cancelled before activation
    ACTIVE --> PAST_DUE: renewal failed
    ACTIVE --> CANCELLED: admin cancel / plan stop
    PAST_DUE --> ACTIVE: payment recovered
    PAST_DUE --> CANCELLED: grace period ended
    EXPIRED --> PENDING: new checkout started
    CANCELLED --> PENDING: re-subscribe
```

### PaymentTransaction lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> SUCCESS: provider confirmed
    PENDING --> FAILED: provider rejected
    PENDING --> EXPIRED: payment window ended
    PENDING --> CANCELLED: user aborted checkout
    SUCCESS --> REFUNDED: refund completed
    SUCCESS --> CHARGEBACK: dispute / reversal
    FAILED --> PENDING: retry checkout
    EXPIRED --> PENDING: retry checkout
    CANCELLED --> PENDING: new checkout
```

### State machine notes
- `Subscription` và `PaymentTransaction` không nên dùng chung một status enum vì semantics khác nhau.
- `Subscription` phản ánh quyền sử dụng dịch vụ của workspace.
- `PaymentTransaction` phản ánh trạng thái giao dịch với Momo hoặc payment provider.
- `Subscription = ACTIVE` chỉ nên xảy ra khi có một giao dịch hợp lệ được xác nhận thành công.
- các transition từ callback phải idempotent để tránh double-processing khi provider retry.
- nếu có gia hạn gói, nên cân nhắc tạo transaction mới thay vì overwrite transaction cũ để giữ audit trail đầy đủ.

---

## Reuse strategy

Không xây mới pipeline CV.

Các thành phần hiện có cần tái sử dụng:
- `api-gateway/src/applications/applications.service.ts`
- `api-gateway/src/storage/storage.service.ts`
- `api-gateway/src/queue/queue.service.ts`
- `api-gateway/src/queue/constants/queue.constants.ts`
- `api-gateway/src/jobs/jobs.service.ts`
- `api-gateway/prisma/schema.prisma`

Nguyên tắc:
- API Gateway vẫn là nơi giữ validation và business rules
- n8n chỉ đóng vai trò automation input
- không cho n8n ghi DB trực tiếp
- không cho n8n publish queue trực tiếp ở phase đầu

---

## Recommended implementation phases

### Phase 1 — Automation / Ingestion
Module mới cho Gmail + n8n ingestion.

Dự kiến gồm:
- ingestion controller / endpoint
- source authentication cho n8n
- subject-tag to job mapping
- duplicate prevention / idempotency
- upload + application creation + queue publish

### Phase 2 — Billing / Subscription / Payment
Module mới cho package registration và thanh toán.

Dự kiến gồm:
- plan catalog
- subscription lifecycle
- payment transaction tracking
- Momo integration

### Phase 3 — Entitlement / Feature Gating
Kiểm soát tính năng theo gói.

Ví dụ:
- số lượng JD đang hoạt động
- số lượng CV được parse mỗi kỳ
- bật/tắt Gmail automation
- các tính năng Smart ATS nâng cao
- số lượng member cùng tham gia workspace/board

---

## Architecture direction

### Confirmed
- Đây là bài toán enterprise, không chỉ là single-user billing.
- Các gói cao sẽ cần nhiều HR/Recruiter cùng tham gia vào một board/workspace.
- Momo là payment gateway ưu tiên hiện tại trong tài liệu.

### Still open
- Billing owner cuối cùng chưa chốt ở mức schema production.
- Tuy nhiên hướng tài liệu hiện tại sẽ nghiêng về `Workspace/Organization-first` thay vì `User-first`.

Điều này có nghĩa là:
- subscription về lâu dài nên gắn với workspace/organization
- user chỉ là member trong workspace
- entitlement được kiểm tra theo workspace plan

---

## Planned modules for team assignment

### A. Automation / Ingestion Module
**Boundary:** xử lý inbound automation từ Gmail/n8n đến trước thời điểm ATS core pipeline tiếp tục qua `cv.uploaded`.

**Phụ trách:**
- endpoint cho n8n
- file validation
- subject mapping
- duplicate protection
- integration với application + queue flow hiện có

**Owns mainly:**
- `JobIngestionRule`
- `IngestionEvent`
- protected ingestion API contract
- source authentication cho automation calls

**Suggested ownership:** 1 backend member tập trung vào API Gateway integration và event-safe ingestion.

### B. Billing / Payment Module
**Boundary:** quản lý catalogue gói, lifecycle subscription và payment state, nhưng không trực tiếp chứa ATS recruitment logic.

**Phụ trách:**
- package definitions
- subscription lifecycle
- payment status
- Momo callback / reconciliation flow

**Owns mainly:**
- `SubscriptionPlan`
- `Subscription`
- `PaymentTransaction`
- payment provider adapter / webhook handling

**Suggested ownership:** 1 backend member tập trung vào payment flow, callback handling và trạng thái giao dịch.

### C. Workspace / Membership Module
**Boundary:** quản lý chủ thể enterprise dùng chung board/workspace và member collaboration.

**Phụ trách:**
- workspace entity
- member invites / roles
- recruiter collaboration trong cùng board

**Owns mainly:**
- `Workspace`
- `WorkspaceMember`
- workspace-level access model
- future organization/membership rules

**Suggested ownership:** 1 backend member tập trung vào access model và enterprise collaboration structure.

### D. Entitlement Module
**Boundary:** đọc plan/subscription state để quyết định workspace có được dùng tính năng nào và quota còn lại bao nhiêu.

**Phụ trách:**
- kiểm tra quyền theo plan
- usage quotas
- gating ở job creation, ingestion, parsing, automation

**Owns mainly:**
- entitlement evaluation rules
- usage counters / quota policy
- service-level checks hoặc guards cho feature gating

**Suggested ownership:** có thể đi cùng người làm Billing nếu team nhỏ; nếu team lớn hơn thì tách riêng cho 1 member để giảm coupling.

## Module boundaries summary

- **Automation/Ingestion** chịu trách nhiệm đưa dữ liệu từ Gmail/n8n vào hệ thống một cách an toàn.
- **Billing/Payment** chịu trách nhiệm xử lý tiền và trạng thái subscription.
- **Workspace/Membership** chịu trách nhiệm mô hình cộng tác enterprise nhiều recruiter trên cùng board.
- **Entitlement** chịu trách nhiệm quyết định workspace hiện tại được làm gì dựa trên plan đang active.

Nguyên tắc chia ranh giới:
- không nhét payment logic vào auth guard chung
- không để n8n bypass business rules của API Gateway
- không để entitlement rules rải rác khắp codebase mà không có một lớp kiểm tra thống nhất

---

## Biggest risks

1. **Workspace model chưa được chốt hoàn toàn**
   - ảnh hưởng trực tiếp tới schema billing và entitlement.

2. **Subject mapping có thể sai job**
   - cần rule rõ ràng và audit trail.

3. **Duplicate ingestion do retry từ Gmail/n8n**
   - cần idempotency key và event tracking.

4. **Security boundary cho inbound endpoint**
   - phải validate file type, size, source auth và không tin metadata từ bên ngoài.

5. **Payment lifecycle complexity**
   - callback, pending state, failed state, reconciliation, subscription activation cần được mô tả rõ.

---

## Task Breakdown & Execution Order

Task breakdown chi tiết đã được tách sang file riêng để team có thể dùng như checklist khi assign và theo dõi tiến độ:

- [SMART_ATS_TASK_BREAKDOWN.md](./SMART_ATS_TASK_BREAKDOWN.md)

File này bao gồm:
- checklist theo phase
- dependency giữa các task
- suggested assignment by member
- suggested execution order
- ready-to-drop first wave

---

## Related docs

- [TEAM_DECISIONS.md](./TEAM_DECISIONS.md)
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- [SRS.md](./SRS.md)
