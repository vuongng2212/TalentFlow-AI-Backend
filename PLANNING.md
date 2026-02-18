# Kế hoạch 1 tuần (api-gateway)

## Mục tiêu & Ưu tiên
- Ưu tiên tuần: Auth/RBAC/JWT; Jobs/Applications CRUD; Upload CV → Cloudflare R2 + RabbitMQ producer; nền tảng quan sát (health/metrics/logs/queue depth).
- Lộ trình: dev local → Docker Compose → k8s (kèm ELK + Prometheus/Grafana hook). Định nghĩa hoàn tất: tests (>=80% critical paths), giới hạn rate/size/timeout, docs & API reference cập nhật.

## Giả định
- Service: `api-gateway/` (NestJS 10, Node 20, Prisma 5, RabbitMQ, R2 S3-compatible). RabbitMQ thay cho BullMQ; PostgreSQL; MinIO local/R2 prod; Swagger/OpenAPI sẵn sàng.
- Biến môi trường: JWT_* (secret/exp), DATABASE_URL, REDIS_URL, R2_*, rate limit, CSRF, upload limits.

## Sprint slices (1 tuần, thực thi tuần tự)
### Slice 0: Nền tảng deploy & observability
- ConfigModule + schema validate ENV; default rate limit, body size, timeout.
- Logger JSON + requestId middleware; không log secrets.
- Health/readiness: DB, RabbitMQ (optional Redis cache); `/health`, `/ready`.
- Metrics endpoint (Prometheus) cho HTTP latency/RPS/error, queue depth.
- CORS/CSRF cấu hình dev/prod; lint/test/build baseline kiểm tra.

### Slice 1: Auth/RBAC/JWT
- Prisma models User + roles; bcrypt/argon2; access 15m, refresh 7d; rotation + revoke store.
- Guards: JWT + Roles + decorator/policy.
- Tests: unit services/guards, e2e login/refresh/protected.
- Docs: Swagger schemas/errors.

### Slice 2: Jobs & Applications CRUD
- Prisma migrations: jobs, applications (link job/candidate); pagination/filter cơ bản.
- Services/controllers với DTO validation; ownership/role checks.
- Tests: unit (services/policies), e2e happy + forbidden.
- Docs: Swagger tags/schemas.

### Slice 3: Upload CV → R2 + RabbitMQ
- Validate MIME (PDF/DOCX), size 10MB; sanitize key (uuid); upload R2 (MinIO local), lưu metadata.
- RabbitMQ producer payload {candidateId, jobId, fileKey/url}; use exchanges/queues (e.g., exchange `cv_parser`, queue `cv_parser.jobs`); attempts/backoff, DLQ/failed queue; config via RABBITMQ_URL.
- Enforce limits/timeouts; response với key/URL; optional presigned URL.
- Tests: unit (validation, queue payload), e2e happy/invalid.
- Docs: API contract + queue payload schema.

### Slice 4: Observability & perf hardening
- Structured logs, log ship stub (Logstash/ELK); correlation-id.
- Metrics wiring để Prometheus scrape; queue depth export; Bull Board (auth-protected) optional.
- Pagination defaults; max payload/file size; tắt gzip cho upload route.
- Docs: update README runbook, `docs/API_REFERENCE.md` links từ `docs/INDEX.md` nếu cần.

### Slice 5: Delivery paths (dev → Docker → k8s)
- Dev/local: npm scripts, prisma migrate dev, `.env.example` đồng bộ.
- Docker Compose: api + postgres + redis + minio; healthcheck; build/start commands.
- K8s: Deployment/Service/Ingress (TLS), ConfigMap/Secret env, liveness/readiness probes, HPA hints (CPU/RAM), ServiceMonitor cho Prometheus, log shipping sidecar (ELK).
- CI gate: lint, test, test:e2e, build, prisma migrate diff/deploy (dry-run nếu chưa có DB).

## Kiểm chứng
- `npm run lint && npm run test && npm run test:e2e && npm run build` trong `api-gateway/`.
- Prisma migrate diff/deploy (dry-run) trước khi chạy thật.
- Docker Compose up thành công, health/readiness 200.
- (Nếu có cluster) k8s manifests `--dry-run=client -o yaml` và probes pass; optional k6 baseline (health/auth/jobs list).
