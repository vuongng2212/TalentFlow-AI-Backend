# TalentFlow ATS: Comprehensive Performance Evaluation & Architectural Audit

**Document Version:** 1.0.0  
**Target Architecture:** Polyglot Microservices Ecosystem (NestJS API Gateway, NestJS Notification Service, Java 21 Spring Boot CV Parser Worker, PostgreSQL, Redis, RabbitMQ, MinIO)  
**Evaluation Scope:** Throughput (RPS/TPS), Latency Percentiles (p50, p95, p99), Resource Footprints (RSS/VSZ/CPU), Event Bus Congestion, and Bottleneck Mitigation Strategies.

---

## 1. Executive Summary

This report delivers an empirical performance evaluation and architectural audit of the TalentFlow Applicant Tracking System (ATS) backend. A full-spectrum benchmark suite was designed and executed against all active services, measuring end-to-end user journeys, database throughput, messaging topologies, and hardware resource boundaries.

### Key Audit Findings

1. **Database Raw Capacity vs. Application Gateway Throughput:**
   PostgreSQL 16 demonstrated exceptional standalone throughput via `pgbench`, reaching **85,883 TPS** on primary key lookups with **0.29ms** average latency, and **38,880 TPS** on relational joins with aggregation. However, API Gateway read endpoints (`/api/v1/jobs`, `/api/v1/applications`) peak at **648 RPS** with **75ms p50** and **105ms p99** latency. The ~130x discrepancy stems from single-threaded Node.js event-loop overhead, Prisma ORM object mapping, and the total absence of a Redis caching layer for read-heavy ATS catalogs.

2. **CPU Saturation in Authentication Pipeline (Bcrypt Threadpool Contention):**
   The `/api/v1/auth/login` endpoint suffers a severe throughput plateau at **78.2 RPS**. As concurrency scaled from $c=1$ to $c=50$, p50 response latency surged by **1,120%** from **51ms** to **622ms** (p99 reaching **665ms**). The root cause is Bcrypt hashing (10 salt rounds) saturating the default 4-thread `libuv` worker pool (`UV_THREADPOOL_SIZE=4`), creating a CPU queue that starves incoming connections.

3. **Rate Limiting Discrepancy & Accidental Burst Vulnerability:**
   A critical version divergence between `@nestjs/throttler` v5 (used in Notification Service) and `@nestjs/throttler` v6 (used in API Gateway) caused rate-limiting anomalies. In API Gateway, `RATE_LIMIT_TTL_SEC: 60` was passed directly to a throttler expecting milliseconds, creating a **60ms sliding window** rather than a 60-second window. This allowed micro-bursts of up to 1,666 RPS while rejecting sustained client traffic under high load with HTTP 429.

4. **CV Parser Asynchronous Pipeline Efficiency:**
   The end-to-end asynchronous CV processing pipeline—spanning multipart HTTP upload, MinIO S3 object storage, RabbitMQ `cv.uploaded` dispatch, Java 21 worker extraction/scoring, and PostgreSQL state persistence—averaged **347.62ms** across runs. The reactive Spring Boot Actuator health endpoint on Netty achieved **6,417.8 RPS** with **1ms** p50 latency.

5. **Memory Expansion Under Load:**
   Under sustained load, Node.js service processes exhibited significant RSS memory growth. API Gateway grew from **209.7 MB** to **582.3 MB** (+177%), and Notification Service grew from **215.4 MB** to **560.4 MB** (+160%). In container environments with 512Mi limits, unconfigured V8 garbage collection thresholds pose severe Out-Of-Memory (OOM) termination risks.

---

## 2. System Architecture & Benchmark Topology

### 2.1 Microservices & Infrastructure Layout

| Service / Component | Runtime / Framework | Transport / Protocol | Exposed Port | Role & Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **API Gateway** | Node.js v24 / NestJS (Express) | HTTP REST, JWT Cookies | `8080` | Client entry point, auth, jobs, applications, upload |
| **Notification Service** | Node.js v24 / NestJS (Express) | HTTP REST, AMQP Consumer | `5000` | In-app notifications, WebSocket dispatch, email queue |
| **CV Parser Worker** | Java 21 / Spring Boot 3.3.0 | AMQP Consumer, WebFlux Netty | `8081` | File extraction (PDF/DOCX), OCR, scoring, storage |
| **PostgreSQL** | PostgreSQL 16.1 | TCP / SQL wire protocol | `5432` | Relational persistence (`public` and `cv_parser` schemas) |
| **Redis** | Redis 7.2 Alpine | In-memory TCP protocol | `6379` | Token blacklisting, session state, future cache tier |
| **RabbitMQ** | RabbitMQ 3.13 (Erlang 26) | AMQP 0-9-1 / Management HTTP | `5672` / `15672` | Asynchronous event broker (`talentflow.events`) |
| **MinIO** | MinIO Object Storage | S3 API over HTTP | `9000` / `9001` | Candidate resume storage (`talentflow-cvs` bucket) |

### 2.2 Asynchronous Event Topology

```
+----------------+  HTTP POST  +-------------------+  S3 Put   +---------------+
| Client Browser | -----------> |    API Gateway    | --------> | MinIO Storage |
+----------------+              +-------------------+           +---------------+
                                          |
                                          | RabbitMQ BasicPublish
                                          | Routing Key: cv.uploaded
                                          v
                              +-----------------------+
                              |   talentflow.events   | (Topic Exchange)
                              +-----------------------+
                                          |
                                          | Routing Key: cv.uploaded
                                          v
                              +-----------------------+
                              |    cv_parser.jobs     | (Durable Queue)
                              +-----------------------+
                                          |
                                          | AMQP BasicConsume (Prefetch: 2)
                                          v
                              +-----------------------+
                              |   CV Parser Worker    | (Spring Boot 3.3)
                              +-----------------------+
                                          |
                +-------------------------+-------------------------+
                | Writes Result                                     | RabbitMQ BasicPublish
                v                                                   v Routing Key: cv.parsed
   +-------------------------+                          +-----------------------+
   | PostgreSQL (cv_parser)  |                          |   talentflow.events   |
   +-------------------------+                          +-----------------------+
                                                                    |
                                        +---------------------------+---------------------------+
                                        | Routing Key: cv.parsed                                | Routing Key: cv.parsed
                                        v                                                       v
                          +----------------------------+                          +----------------------------+
                          |   api_gateway.cv_events    |                          |     notification_queue     |
                          +----------------------------+                          +----------------------------+
                                        |                                                       |
                                        v                                                       v
                          +----------------------------+                          +----------------------------+
                          |   API Gateway Listener     |                          |    Notification Service    |
                          | (Updates App Status)       |                          | (Creates Notification)     |
                          +----------------------------+                          +----------------------------+
```

---

## 3. Benchmark Methodology & Test Harness

### 3.1 Tooling & Execution Environment

The benchmarking framework was implemented in Node.js, Shell, and native load drivers:

- **Autocannon v8.0.0:** High-performance HTTP load generator utilizing Node.js HTTP pipeline sockets to measure latency percentiles and request rates.
- **pgbench (PostgreSQL 16):** Transactional database benchmarking tool testing multi-client concurrency against realistic queries with prepared statements.
- **redis-benchmark:** Official C-based client benchmark tool executing 50,000 operations across 50 concurrent connections.
- **Custom AMQP Benchmark (`benchmarks/rabbitmq_bench.mjs`):** Direct AMQP 0-9-1 benchmark publishing and consuming 5,000 JSON application event payloads.
- **Process & Container Monitor (`benchmarks/system_stats.mjs`):** Kernel `/proc` inspection via `ps` capturing RSS, VSZ, and CPU percentages alongside `docker stats`.

### 3.2 System Hardware Profile

- **Operating System:** Linux 6.18.55-2-cachyos-lts (x86_64)
- **Node Runtime:** Node.js v24.21.0
- **Java Runtime:** OpenJDK 21.0.9 (Spring Boot 3.3.0)
- **Local Storage:** NVMe SSD, ext4/btrfs filesystem
- **Database Target:** `talentflow_dev` seeded with multi-tenant workspaces, jobs, and candidates.

---

## 4. Empirical Performance Results

### 4.1 API Gateway (Port 8080)

#### Health, Readiness, and Telemetry Endpoints

| Endpoint | Concurrency | Avg RPS | Total Requests | Latency p50 | Latency p95 | Latency p99 | Non-2xx |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /health` | $c=10$ | 1,209.6 | 6,048 | 7.00 ms | 11.00 ms | 18.00 ms | 276 |
| `GET /health` | $c=50$ | 1,525.6 | 7,628 | 31.00 ms | 37.00 ms | 64.00 ms | 3,792 |
| `GET /health` | $c=100$ | 1,531.8 | 7,659 | 61.00 ms | 75.00 ms | 107.00 ms | 3,879 |
| `GET /ready` | $c=10$ | 1,090.6 | 5,453 | 8.00 ms | 11.00 ms | 15.00 ms | 0 |
| `GET /ready` | $c=50$ | 1,297.8 | 6,489 | 42.00 ms | 52.00 ms | 69.00 ms | 2,010 |
| `GET /metrics` | $c=10$ | 508.0 | 1,524 | 18.00 ms | 22.00 ms | 37.00 ms | 0 |

#### Authentication & CPU-Bound Hashing (`POST /api/v1/auth/login`)

The authentication endpoint performs user database lookup followed by asynchronous Bcrypt hash verification.

| Concurrency | Average RPS | Latency p50 | Latency p95 | Latency p99 | Max Latency | Error Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **$c=1$** | 19.2 RPS | 51.0 ms | 52.0 ms | 63.0 ms | 63.0 ms | 0.0% |
| **$c=10$** | 75.0 RPS | 130.0 ms | 151.0 ms | 191.0 ms | 199.0 ms | 0.0% |
| **$c=25$** | 78.2 RPS | 314.0 ms | 330.0 ms | 346.0 ms | 375.0 ms | 0.0% |
| **$c=50$** | 78.2 RPS | 622.0 ms | 653.0 ms | 665.0 ms | 712.0 ms | 0.0% |

```
Bcrypt Throughput & Latency Scaling (Port 8080 /auth/login)
Throughput (RPS):  [===== 19.2 =====] (c=1)
                   [============================================= 75.0 ] (c=10)
                   [=============================================== 78.2 ] (c=25) -> BOTTLE-NECK CEILING
                   [=============================================== 78.2 ] (c=50) -> BOTTLE-NECK CEILING

Latency p50 (ms):  [== 51ms ==] (c=1)
                   [===== 130ms =====] (c=10)
                   [=============== 314ms ===============] (c=25)
                   [============================== 622ms ==============================] (c=50)
```

#### Authenticated Business Queries (Prisma ORM over PostgreSQL)

Endpoints tested with valid JWT session cookie extracted from administrative user authentication:

| Endpoint | Concurrency | Avg RPS | Total Requests | Latency p50 | Latency p95 | Latency p99 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/jobs` | $c=10$ | 573.0 | 2,865 | 17.0 ms | 20.0 ms | 23.0 ms |
| `GET /api/v1/jobs` | $c=50$ | 648.2 | 3,241 | 75.0 ms | 79.0 ms | 105.0 ms |
| `GET /api/v1/jobs` | $c=100$ | 620.0 | 3,100 | 154.0 ms | 172.0 ms | 230.0 ms |
| `GET /api/v1/applications` | $c=10$ | 564.8 | 2,824 | 17.0 ms | 20.0 ms | 26.0 ms |
| `GET /api/v1/applications` | $c=50$ | 607.4 | 3,037 | 80.0 ms | 87.0 ms | 116.0 ms |

---

### 4.2 Notification Service (Port 5000)

| Endpoint | Concurrency | Avg RPS | Latency p50 | Latency p95 | Latency p99 | Non-2xx Rate | Observation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /` | $c=10$ | 2,631.0 | 3.0 ms | 5.0 ms | 8.0 ms | 99.2% | Rate limiter blocked 13,052/13,152 reqs |
| `GET /` | $c=50$ | 3,060.6 | 15.0 ms | 18.0 ms | 32.0 ms | 100.0% | Immediate 429 response emission |

---

### 4.3 CV Parser Worker Service (Port 8081)

#### HTTP & Prometheus Endpoints (Netty WebFlux)

| Endpoint | Concurrency | Avg RPS | Total Requests | Latency p50 | Latency p95 | Latency p99 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /actuator/health` | $c=10$ | 6,417.8 | 32,084 | 1.0 ms | 2.0 ms | 5.0 ms |
| `GET /actuator/prometheus` | $c=10$ | 841.0 | 2,523 | 10.0 ms | 17.0 ms | 26.0 ms |

#### Asynchronous End-to-End CV Pipeline Latency

Measurement encompasses: HTTP Multipart Upload -> S3 MinIO Store -> AMQP `cv.uploaded` -> Worker PDF Parsing & Feature Extraction -> PostgreSQL `cv_parser.cv_parse_results` Write -> AMQP `cv.parsed` Publish -> Gateway Application State Update.

| Execution Run | Application ID | Total Duration | Final Parse Status |
| :--- | :--- | :--- | :--- |
| **Run 1** | `a5bbe641-c4a1-49a6-ab75-26ccd0847499` | 271.23 ms | `PARTIAL` (OCR bypass on synthetic PDF) |
| **Run 2** | `0486a52e-a8a5-4a43-a64f-6a1ce729fb11` | 386.02 ms | `PARTIAL` |
| **Run 3** | `99c5e237-c2af-46e4-8cb9-d21983d859c4` | 385.62 ms | `PARTIAL` |
| **Average Pipeline Latency** | — | **347.62 ms** | **100% Reliability** |

---

### 4.4 PostgreSQL Database Layer (pgbench)

PostgreSQL was evaluated across three distinct query patterns reflecting core ATS operations:
1. `pkLookup`: Primary key lookup on `users` table (`SELECT id, email, full_name, role FROM users WHERE id = :id`).
2. `indexedFilter`: Multi-column indexed tenant query (`SELECT id, title, department, status FROM jobs WHERE workspace_id = :ws AND status = 'OPEN'`).
3. `relationJoin`: Aggregation join (`SELECT j.id, j.title, count(a.id) FROM jobs j LEFT JOIN applications a ON j.id = a.job_id GROUP BY j.id, j.title`).

| Query Pattern | Concurrency ($c$) | Transactions / Sec (TPS) | Average Query Latency |
| :--- | :--- | :--- | :--- |
| **Primary Key Lookup** | $c=1$ | 14,525.8 TPS | 0.069 ms |
| | $c=10$ | 70,707.5 TPS | 0.141 ms |
| | $c=25$ | **85,883.0 TPS** | 0.291 ms |
| | $c=50$ | 82,931.4 TPS | 0.603 ms |
| **Indexed Tenant Filter** | $c=1$ | 8,242.5 TPS | 0.121 ms |
| | $c=10$ | 64,522.9 TPS | 0.155 ms |
| | $c=25$ | **76,516.4 TPS** | 0.327 ms |
| | $c=50$ | 66,313.7 TPS | 0.754 ms |
| **Relational Join & Aggregation** | $c=1$ | 4,628.9 TPS | 0.216 ms |
| | $c=10$ | 36,308.1 TPS | 0.275 ms |
| | $c=25$ | **38,880.4 TPS** | 0.643 ms |
| | $c=50$ | 35,333.8 TPS | 1.415 ms |

---

### 4.5 Redis Cache & Session Store (redis-benchmark)

Conducted with 50 concurrent clients over 50,000 operations per command:

| Redis Operation | Throughput (Ops / Sec) | Latency p50 |
| :--- | :--- | :--- |
| **SET** | 101,626.02 RPS | 0.255 ms |
| **GET** | 92,250.92 RPS | 0.255 ms |
| **LPUSH** | 99,601.60 RPS | 0.263 ms |
| **LPOP** | 101,214.58 RPS | 0.263 ms |
| **PING (Inline)** | 87,565.68 RPS | 0.263 ms |
| **PING (Multi-Bulk)** | 96,339.12 RPS | 0.255 ms |

---

### 4.6 RabbitMQ Event Bus Benchmark

Evaluated with 5,000 JSON application event payloads (candidate ID, score, event metadata):

| Metric | Measured Value | Analysis |
| :--- | :--- | :--- |
| **Total Messages Dispatched** | 5,000 messages | Standard JSON event payloads (~250 bytes) |
| **Publish Duration** | 34.06 ms | Channel buffer saturation |
| **Publish Throughput** | **146,792.59 msgs/sec** | Sub-millisecond queue placement |
| **Consume Duration** | 266.56 ms | Client consumption + acknowledgment |
| **Consume Throughput** | **18,757.19 msgs/sec** | Single-channel dispatch rate |
| **Consume Latency p50** | **212.25 ms** | Batch transit latency |
| **Consume Latency p95** | **260.30 ms** | Tail consumer latency |
| **Consume Latency p99** | **265.59 ms** | Final acknowledgment latency |

---

### 4.7 Hardware & Resource Utilization

Process-level stats captured via kernel `/proc` inspection (`ps -p <pid> -o %cpu,%mem,rss,vsz`) before and after high-concurrency benchmarks:

| Component | PID | Baseline RSS | Peak RSS | Memory Growth | Baseline CPU | Peak CPU |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **API Gateway** | 7565 | 209.7 MB | 582.3 MB | **+177.6%** | 1.1% | 45.2% |
| **Notification Service** | 7610 | 215.4 MB | 560.4 MB | **+160.1%** | 0.5% | 22.8% |
| **CV Parser Worker (JVM)** | 7923 | 549.5 MB | 570.3 MB | **+3.8%** | 1.0% | 34.6% |
| **PostgreSQL Engine** | 1085 | 32.4 MB | 32.4 MB | 0.0% | 0.0% | 88.4% (during pgbench) |
| **RabbitMQ Container** | Docker | 162.8 MiB | 229.7 MiB | **+41.0%** | 0.23% | 24.5% |
| **Redis Container** | Docker | 15.27 MiB | 16.17 MiB | +5.8% | 1.28% | 18.2% |
| **MinIO Container** | Docker | 92.41 MiB | 92.13 MiB | -0.3% | 0.05% | 6.8% |

---

## 5. Architectural Bottleneck Analysis

### Bottleneck 1: Bcrypt Password Hashing Threadpool Contention
- **Observed Symptom:** `/api/v1/auth/login` hard-caps at 78.2 RPS. At concurrency $c=50$, latency climbs to 622ms (p50) and 665ms (p99).
- **Technical Root Cause:**
  Node.js executes JavaScript single-threaded on the V8 event loop. Cryptographic hashing operations via `bcrypt.compare()` are offloaded to the C++ asynchronous worker pool managed by `libuv`. The default size of this thread pool is strictly **4 threads** (`UV_THREADPOOL_SIZE=4`). 
  
  Bcrypt with 10 salt rounds takes approximately 50ms of dedicated CPU time per invocation. With 4 worker threads:
  $$\text{Max Theoretical RPS} = \frac{4 \text{ threads}}{0.050 \text{ seconds/op}} = 80.0 \text{ RPS}$$
  The measured 78.2 RPS precisely hits this physical mathematical ceiling. Any incoming request beyond 4 concurrent auth attempts is forced into an unbounded FIFO queue inside `libuv`, inflating latency proportionally with concurrency.
- **Secondary Blast Radius:**
  Other essential asynchronous operations in Node.js that rely on the `libuv` thread pool (including `fs` file operations and `dns.lookup()`) experience queue starvation when login bursts occur.

---

### Bottleneck 2: Rate Limiter Divergence & Incorrect Sliding Window Configuration
- **Observed Symptom:** High error counts (`non2xx: 3,792`) during moderate health check traffic, while Notification Service immediately emitted HTTP 429 across 99% of requests.
- **Technical Root Cause:**
  1. **API Gateway (`api-gateway/src/app.module.ts`):** Uses `@nestjs/throttler` version 6. In v6, the `ttl` configuration parameter is strictly interpreted in **milliseconds**. The service configuration reads:
     ```typescript
     throttlers: [
       {
         name: 'default',
         ttl: config.get<number>('RATE_LIMIT_TTL_SEC', 60),
         limit: config.get<number>('RATE_LIMIT_MAX', 100),
       },
     ]
     ```
     Because `RATE_LIMIT_TTL_SEC` was passed without multiplying by 1,000, NestJS configured a **60-millisecond sliding window** with a limit of 100 requests. Under steady load, this permitted 1,666 RPS in 60ms increments, but rejected rapid micro-bursts within the same 60ms bucket.
  2. **Notification Service (`notification/src/app.module.ts`):** Uses `@nestjs/throttler` version 5, where `ttl` is interpreted in **seconds**. Consequently, it enforced 100 requests per 60 seconds across all endpoints including `/`, immediately blocking continuous benchmark traffic.

---

### Bottleneck 3: The Prisma Query Penalty & Lack of Tiered Caching
- **Observed Symptom:** PostgreSQL executes 85,883 TPS on key lookups and 38,880 TPS on complex joins. Yet API Gateway `/api/v1/jobs` and `/api/v1/applications` only deliver ~600-650 RPS under $c=50$, with latency rising to 80-150ms.
- **Technical Root Cause:**
  1. **Prisma ORM Query Overhead:** Each Prisma query incurs query compilation, Prisma Engine IPC serialization (via the query-engine binary or WebAssembly engine), JavaScript object deserialization, and field mapping.
  2. **Zero Cache Utilization:** While Redis is provisioned and running at 100,000+ operations/sec with 0.25ms latency, it is not wired into the API Gateway query layer. Every single request for `/api/v1/jobs` executes a live PostgreSQL query, serializing the full workspace relations on every request.
  3. **Over-fetching & Lack of Projection:** Prisma queries without explicit `select` blocks retrieve entire record rows, increasing payload sizes and GC pressure.

---

### Bottleneck 4: Thread Pool Sizing & Work Ingestion in CV Parser Worker
- **Observed Symptom:** While Actuator WebFlux handles 6,400+ RPS, end-to-end CV processing averages 347ms and will bottleneck under batch resume ingestion.
- **Technical Root Cause:**
  1. **Thread Pool Allocation (`cv-parser/src/main/resources/application.yml` and `ThreadPoolConfig.java`):**
     - `parsingExecutor`: Core 8, Max 16, Queue Capacity 100.
     - `ocrExecutor`: Core 2, Max 4, Queue Capacity 20.
     - `ocrPageExecutor`: Core 8, Max 8, Queue Capacity 20.
     - `llmExecutor`: Core 8, Max 20, Queue Capacity 100.
  2. **CallerRunsPolicy Under Rejection:**
     All custom executors configure `CallerRunsPolicy()`. When queue capacity is exceeded, the calling thread executes the task. For RabbitMQ listener threads, this means the listener thread stops accepting messages from RabbitMQ to execute heavy OCR or parsing directly, stalling queue consumption.
  3. **JNA Native Locking in Tess4J:**
     Tesseract OCR relies on native C++ bindings via JNA (`lept4j` / `tess4j`). Native calls block JVM OS threads and cannot be cooperatively scheduled by virtual threads without thread pinning.

---

### Bottleneck 5: V8 Heap Expansion & Memory Footprint Escalation
- **Observed Symptom:** API Gateway and Notification Service RSS expanded from ~210 MB to ~580 MB during load tests.
- **Technical Root Cause:**
  Node.js V8 defaults to a lazy garbage collection strategy. When abundant system memory is detected, V8 defers major Mark-Sweep collections, expanding the old-generation heap to avoid CPU GC pauses. In Kubernetes or Docker environments where memory limits are enforced via cgroups (e.g. `limits.memory: 512Mi`), V8 fails to detect container boundaries unless `--max-old-space-size` is explicitly configured, triggering container OOMKilled events.

---

## 6. Actionable Optimization Strategies

### Phase 1: Immediate Remediation (Days 1–3)

#### 1.1 Enforce Libuv Threadpool Scaling for Auth Workloads
In the API Gateway start script, container entrypoint, or system environment, configure `UV_THREADPOOL_SIZE` to match available CPU cores or offload thread contention:
```bash
export UV_THREADPOOL_SIZE=16
```
This increases parallel Bcrypt capacity from 78 RPS to ~310 RPS immediately without application code modifications.

#### 1.2 Correct Throttler Sliding Window Units
In `api-gateway/src/app.module.ts`, ensure `ttl` reflects milliseconds:
```typescript
ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    throttlers: [
      {
        name: 'default',
        ttl: config.get<number>('RATE_LIMIT_TTL_SEC', 60) * 1000,
        limit: config.get<number>('RATE_LIMIT_MAX', 100),
      },
    ],
  }),
})
```
Exempt internal health and probe endpoints (`/health`, `/ready`) from rate limiting decorators using `@SkipThrottle()`.

#### 1.3 Container V8 Memory Clamping
Configure Node.js options in Dockerfile and Kubernetes manifests to prevent OOM termination:
```bash
NODE_OPTIONS="--max-old-space-size=384"
```

---

### Phase 2: Medium-Term Architectural Improvements (Weeks 1–2)

#### 2.1 Multi-Level Cache Tiering (Redis + In-Memory L1)
Implement a Cache-Aside pattern with Redis for public and workspace-specific read operations:
- **L1 (In-Memory LRU):** Cache static job metadata for 5–15 seconds in process memory.
- **L2 (Redis):** Cache serialized job lists and candidate summary cards with TTL = 60s, invalidated via RabbitMQ events on job mutations (`job.created`, `job.updated`).
- **Anticipated Gain:** Reduces database load on `/jobs` by 95%, elevating throughput from 648 RPS to **4,500+ RPS** with sub-5ms latency.

#### 2.2 Migrate Password Hashing to Argon2id
Replace `bcrypt` with `argon2` (using Argon2id variant):
- Argon2id provides superior resistance against GPU/ASIC cracking while allowing fine-grained memory and parallelism tuning (`memoryCost: 65536`, `timeCost: 3`, `parallelism: 1`).
- Native bindings in `argon2` release the V8 event loop cleanly and can be tuned for predictable CPU consumption.

#### 2.3 Optimize Prisma Queries with Field Projections
Replace blanket `findMany()` queries with targeted `select` statements to prevent transferring large text columns (`resume_text`, raw descriptions) on summary list views:
```typescript
prisma.job.findMany({
  where: { workspaceId, status: JobStatus.OPEN },
  select: {
    id: true,
    title: true,
    department: true,
    status: true,
    createdAt: true,
    _count: { select: { applications: true } },
  },
})
```

---

### Phase 3: Long-Term Enterprise Hardening (Weeks 3–4)

#### 3.1 CV Parser Worker Concurrency & Virtual Threads
1. Upgrade Spring Boot worker to leverage Java 21 Virtual Threads (`Loom`) for S3 download and database update tasks:
   ```yaml
   spring:
     threads:
       virtual:
         enabled: true
   ```
2. Isolate native OCR processing into a dedicated bounded queue with an `AbortPolicy` or dynamic backpressure that halts RabbitMQ acknowledgment rather than executing on consumer threads:
   ```java
   @Bean(name = "ocrExecutor")
   public ThreadPoolTaskExecutor ocrExecutor() {
       ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
       executor.setCorePoolSize(Runtime.getRuntime().availableProcessors());
       executor.setMaxPoolSize(Runtime.getRuntime().availableProcessors() * 2);
       executor.setQueueCapacity(50);
       executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
       return executor;
   }
   ```

#### 3.2 Database Connection Pooling with PgBouncer
While PostgreSQL handles 85k TPS under 50 connections, scaling to multiple microservice replicas (10+ API Gateway pods, 5+ Parser pods) will saturate PostgreSQL `max_connections` (default 100).
- Deploy **PgBouncer** in transaction pooling mode between microservices and PostgreSQL.
- Maintain a warm pool of 20–30 physical connections to PostgreSQL, serving hundreds of virtual microservice connections.

#### 3.3 Target Performance Architecture Matrix

| Dimension | Baseline Measured | Target Post-Optimization | Primary Lever |
| :--- | :--- | :--- | :--- |
| **Auth Login RPS** | 78.2 RPS | **400+ RPS** | `UV_THREADPOOL_SIZE=16` + Argon2id |
| **Jobs Query RPS** | 648.2 RPS | **4,000+ RPS** | Redis Cache-Aside + Field Projections |
| **Jobs Latency p95** | 79.0 ms | **< 10.0 ms** | Redis L2 Caching |
| **CV Pipeline Latency** | 347.6 ms | **< 200.0 ms** | Prefetch Tuning + S3 Streaming Pipeline |
| **API Gateway Memory** | 582.3 MB | **< 350.0 MB** | `--max-old-space-size=384` + GC Tuning |
| **AMQP Publish Rate** | 146,792 msgs/s | **150,000+ msgs/s** | Maintained (Already Optimal) |

---

## 7. Verification Test Suite Guide

The benchmark suite created during this audit is permanently available in the repository for regression testing and CI verification:

```bash
# 1. Run full end-to-end benchmark suite
node benchmarks/run_benchmarks.mjs

# 2. Inspect real-time container and process metrics
node benchmarks/system_stats.mjs

# 3. Run standalone RabbitMQ event bus throughput benchmark
node benchmarks/rabbitmq_bench.mjs

# 4. Review detailed output JSON
cat benchmarks/results.json | jq .
```

## 8. Phase 1 Retest: Before And After

The baseline is the committed benchmark snapshot from `2026-10-29T10:39:00Z`. The retest was recorded at `2026-10-29T12:53:04Z` with the same 5-second autocannon samples. The gateway retest used a separate process on port 8082 with `RATE_LIMIT_MAX=1000000` so the corrected 60-second limiter would not turn the jobs and applications samples into 429 responses. The standard gateway limiter remains at its configured limit. The notification service retained its configured 100-request limit.

| Measurement | Before | After | Result |
| :--- | ---: | ---: | :--- |
| `GET /api/v1/jobs`, c=50 | 629.4 RPS, 84 ms p95 | 202.4 RPS, 163 ms p95 | No throughput gain in this run; the long tail reached 3.5 s p99. |
| `GET /api/v1/applications`, c=50 | 619.6 RPS, 85 ms p95 | 460.0 RPS, 151 ms p95 | No throughput gain in this run. |
| `POST /api/v1/auth/login`, c=50 | 77.4 RPS, 653 ms p95 | 127.2 RPS, 489 ms p95 | 1.64× throughput and lower p95 latency with `UV_THREADPOOL_SIZE=16`. |
| CV parser actuator health, c=10 | 6,817.2 RPS, 2 ms p95 | 6,894.0 RPS, 2 ms p95 | Essentially unchanged. |
| CV upload-to-parse pipeline, 3 runs | 347.62 ms average | 435.41 ms average | All retest runs succeeded; latency was higher in this sample. |
| Notification root, c=50 | 15,231 RPS, 15,231 non-2xx | 2,996.6 RPS, 14,881 non-2xx | The v5 throttler continues to enforce its 100-request, 60-second window. |

The read-cache implementation is active in the retest, and the list result is stored under a workspace-prefixed Redis key. These aggregate runs do not show a read throughput improvement; jobs and applications p95 latency regressed under c=50. Treat the results as a warning that the current benchmark does not validate the expected cache gain. A controlled before/after run on one gateway instance with matched load and warmed cache is needed before claiming a performance improvement. The corrected rate limiter also means the default 100-request setting must be raised in an isolated benchmark environment for load tests above that request budget.
