# PLANNING

## Api Gateway Remaining Tasks

### 1. [API] Slice 4: Observability & perf hardening
**Trạng thái:** Done
**Priority:** P2 - Medium
**Module:** API Gateway (NestJS)
**Mô tả:**
- Structured logs, log ship stub (Logstash/ELK); correlation-id.
- Metrics wiring để Prometheus scrape; queue depth export.
- Pagination defaults; max payload/file size; tắt gzip cho upload route.

**Checklists (Sub-tasks):**
- [x] Structured logs + log ship stub (Logstash/ELK) with correlation-id [P2-Medium]
- [x] Metrics wiring cho Prometheus scrape (HTTP latency/RPS/error, queue depth) [P2-Medium]
- [x] Pagination defaults; max payload/file size; tắt gzip cho upload route [P2-Medium]

### 2. [API] Slice 5: Delivery paths (dev → Docker → k8s)
**Trạng thái:** Done
**Priority:** P2 - Medium
**Module:** API Gateway (NestJS)
**Mô tả:**
- Dev/local: npm scripts, prisma migrate dev, `.env.example` đồng bộ.
- Docker Compose: api + postgres + redis + minio; healthcheck; build/start commands.
- K8s: Deployment/Service/Ingress (TLS), probes, HPA hints, ServiceMonitor.

**Checklists (Sub-tasks):**
- [x] Dev/local: npm scripts, prisma migrate dev, .env.example sync [P1-High]
- [x] Docker Compose: api + postgres + redis + minio + healthcheck [P1-High]
- [x] K8s: Deployment/Service/Ingress (TLS), ConfigMap/Secret, liveness/readiness probes [P1-High]
- [x] HPA hints (CPU/RAM) + ServiceMonitor cho Prometheus + log shipping sidecar (ELK) [P2-Medium]
- [x] CI gate: lint, test, test:e2e, build, prisma migrate diff/deploy [P1-High]
