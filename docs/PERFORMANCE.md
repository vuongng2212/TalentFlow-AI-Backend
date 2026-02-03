# Performance Optimization Guide - TalentFlow AI

**Project:** TalentFlow AI Backend
**Last Updated:** 2026-02-03
**Architecture:** Polyglot 3-Service (NestJS + Spring Boot/ASP.NET Core)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Performance Requirements](#performance-requirements)
- [Load Testing Strategy](#load-testing-strategy)
- [Database Optimization](#database-optimization)
- [Caching Strategy](#caching-strategy)
- [API Gateway Optimization](#api-gateway-optimization)
- [CV Parser Optimization](#cv-parser-optimization)
- [Frontend Performance](#frontend-performance)
- [Network Optimization](#network-optimization)
- [Monitoring & Profiling](#monitoring--profiling)
- [Performance Budget](#performance-budget)

---

## 🎯 Overview

### Why Performance Matters

For TalentFlow AI's **Polyglot 3-Service Architecture**:
- **User Experience:** Fast response times keep recruiters productive
- **Cost Efficiency:** Optimized resource usage reduces cloud costs
- **Scalability:** Well-tuned services handle growth gracefully
- **Competitive Advantage:** 2x faster than traditional ATS

### Performance Principles (Framework-Agnostic)

1. **Measure First:** Don't optimize blindly - use data
2. **Low-Hanging Fruit:** Fix obvious issues before micro-optimizations
3. **80/20 Rule:** 20% of code causes 80% of performance issues
4. **Cache Wisely:** Cache expensive operations, invalidate correctly
5. **Async Everything:** Never block the main thread/event loop

---

## 📊 Performance Requirements

### Service-Level Targets

| Service | Metric | Target | Measurement Tool |
|---------|--------|--------|------------------|
| **API Gateway** | Response Time (p50) | < 100ms | Prometheus |
| **API Gateway** | Response Time (p95) | < 200ms | Prometheus |
| **API Gateway** | Response Time (p99) | < 500ms | Prometheus |
| **API Gateway** | Throughput | 100+ RPS | k6 Load Testing |
| **API Gateway** | Error Rate | < 0.5% | Prometheus |
| **CV Parser** | Processing Time (avg) | < 10s | Application Logs |
| **CV Parser** | Processing Time (p95) | < 15s | Application Logs |
| **Notification** | WebSocket Latency | < 50ms | Custom Metrics |
| **Database** | Query Time (p95) | < 50ms | Prisma/EF Metrics |
| **Database** | Connection Pool | < 80% | Postgres Exporter |
| **BullMQ** | Queue Lag | < 5 msgs | Bull Board |
| **Redis** | Memory Usage | < 1GB | Redis Exporter |

### Business Metrics

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| **CV Upload Throughput** | 1,000 CVs/day | TBD | MVP target |
| **Concurrent Users** | 50 users | TBD | Peak load |
| **Data Size (Year 1)** | < 10GB | 0 | Database size |
| **Uptime** | > 99.5% | TBD | 3.65 days downtime/year |
| **Time to First Byte (TTFB)** | < 600ms | TBD | Global CDN |

---

## 🧪 Load Testing Strategy

### Tools by Framework

| Framework | Recommended Tool | Why |
|-----------|------------------|-----|
| **Any Backend** | **k6** (Primary) | Scriptable in JS, Grafana integration |
| **Any Backend** | **Artillery** | Scenario-based testing |
| **Spring Boot** | JMeter | Java ecosystem, good for JVM apps |
| **ASP.NET Core** | NBomber | Native .NET tool |
| **Frontend** | Lighthouse CI | Core Web Vitals |

### Test Scenarios

#### 1. Baseline Test (Sanity Check)

**Goal:** Verify system works under light load

```javascript
// k6/baseline.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,                  // 10 virtual users
  duration: '5m',           // 5 minutes
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95% < 200ms
    http_req_failed: ['rate<0.01'],     // Error rate < 1%
  },
};

export default function () {
  let res = http.get('https://api.talentflow.ai/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```

**Run:**
```bash
k6 run k6/baseline.js
```

#### 2. Load Test (Expected Traffic)

**Goal:** Test at expected production load

```javascript
// k6/load-test.js
export let options = {
  stages: [
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '5m', target: 50 },   // Stay at 50 users (MVP target)
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.02'],    // 2% error rate acceptable
  },
};

export default function () {
  // Test realistic user flow
  let token = login();
  getJobs(token);
  uploadCV(token);
  sleep(3);
}

function login() {
  let res = http.post('https://api.talentflow.ai/api/v1/auth/login', {
    email: 'test@example.com',
    password: 'password123',
  });
  return res.json('token');
}

function getJobs(token) {
  http.get('https://api.talentflow.ai/api/v1/jobs', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function uploadCV(token) {
  let binFile = open('./sample-cv.pdf', 'b');
  let data = {
    file: http.file(binFile, 'cv.pdf'),
    jobId: 'job_123',
  };
  http.post('https://api.talentflow.ai/api/v1/candidates/upload', data, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

#### 3. Stress Test (Find Breaking Point)

**Goal:** Determine maximum capacity

```javascript
// k6/stress-test.js
export let options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 100 },   // Push to 100 users
    { duration: '5m', target: 150 },   // Push to 150 users
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // Relaxed threshold
    http_req_failed: ['rate<0.1'],      // 10% error acceptable
  },
};
```

#### 4. Spike Test (Traffic Surge)

**Goal:** Test sudden traffic spikes

```javascript
// k6/spike-test.js
export let options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '30s', target: 200 },   // Sudden spike!
    { duration: '1m', target: 10 },
    { duration: '30s', target: 200 },   // Another spike
    { duration: '1m', target: 0 },
  ],
};
```

#### 5. Soak Test (Endurance Test)

**Goal:** Detect memory leaks and degradation

```javascript
// k6/soak-test.js
export let options = {
  stages: [
    { duration: '5m', target: 30 },
    { duration: '1h', target: 30 },    // Stay for 1 hour
    { duration: '5m', target: 0 },
  ],
};
```

### Running Load Tests

```bash
# Local testing
k6 run k6/baseline.js

# Cloud testing (k6 Cloud)
k6 cloud k6/load-test.js

# With Grafana integration
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write k6 run k6/load-test.js

# Generate HTML report
k6 run --out json=results.json k6/load-test.js
k6-reporter results.json --output report.html
```

### Interpreting Results

**Key Metrics:**

```
checks.........................: 95.00%  ✓ 950   ✗ 50
data_received..................: 12 MB   40 kB/s
data_sent......................: 5.8 MB  19 kB/s
http_req_blocked...............: avg=1.2ms   min=0s   med=1ms   max=100ms p(95)=5ms
http_req_connecting............: avg=0.5ms   min=0s   med=0s    max=50ms  p(95)=2ms
http_req_duration..............: avg=150ms   min=50ms med=120ms max=800ms p(95)=300ms ✓
http_req_failed................: 0.50%   ✓ 5     ✗ 995
http_reqs......................: 1000    3.33/s
iteration_duration.............: avg=4.2s    min=3s   med=4s    max=6s    p(95)=5s
iterations.....................: 1000    3.33/s
vus............................: 50      min=50  max=50
vus_max........................: 50      min=50  max=50
```

**Good Indicators:**
- ✅ `http_req_failed` < 1%
- ✅ `http_req_duration` p(95) < target
- ✅ `http_req_duration` increasing = stable system

**Bad Indicators:**
- ❌ `http_req_failed` > 5%
- ❌ `http_req_duration` p(95) > 2x target
- ❌ `http_req_duration` exponentially increasing = bottleneck

---

## 🗄️ Database Optimization

### Framework-Agnostic Principles

#### 1. Indexing Strategy

**When to Index:**
- Foreign keys (jobId, userId)
- Frequently filtered columns (status, createdAt)
- Sort columns (createdAt DESC)

**When NOT to Index:**
- Low cardinality columns (boolean, small enums)
- Frequently updated columns
- Small tables (< 1000 rows)

**PostgreSQL Index Examples:**

```sql
-- Index for frequently queried published jobs
CREATE INDEX idx_jobs_status ON jobs(status) WHERE status = 'PUBLISHED';

-- Composite index for applications query
CREATE INDEX idx_applications_job_stage ON applications(job_id, stage, created_at DESC);

-- Index for user lookups
CREATE INDEX idx_users_email ON users(email);

-- Partial index for active users
CREATE INDEX idx_users_active ON users(id, email) WHERE deleted_at IS NULL;

-- Index for CV search
CREATE INDEX idx_candidates_name ON candidates USING gin(to_tsvector('english', full_name));
```

**Check Index Usage:**
```sql
-- Find unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename;

-- Check index size
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

#### 2. Query Optimization

**Prisma (NestJS):**

```typescript
// ❌ Bad: N+1 query problem
const jobs = await prisma.job.findMany();
for (const job of jobs) {
  const applications = await prisma.application.findMany({
    where: { jobId: job.id },
  });
}

// ✅ Good: Single query with include
const jobs = await prisma.job.findMany({
  include: {
    applications: true,
  },
});

// ✅ Better: Select only needed fields
const jobs = await prisma.job.findMany({
  select: {
    id: true,
    title: true,
    applications: {
      select: { id: true, status: true },
    },
  },
});

// ✅ Best: Use cursor pagination (not offset)
const jobs = await prisma.job.findMany({
  take: 20,
  skip: 1,
  cursor: { id: lastJobId },
  orderBy: { createdAt: 'desc' },
});
```

**Entity Framework Core (ASP.NET):**

```csharp
// ❌ Bad: N+1 query
var jobs = await _context.Jobs.ToListAsync();
foreach (var job in jobs)
{
    var applications = await _context.Applications
        .Where(a => a.JobId == job.Id)
        .ToListAsync();
}

// ✅ Good: Eager loading with Include
var jobs = await _context.Jobs
    .Include(j => j.Applications)
    .ToListAsync();

// ✅ Better: Select only needed fields (Projection)
var jobs = await _context.Jobs
    .Select(j => new {
        j.Id,
        j.Title,
        Applications = j.Applications.Select(a => new { a.Id, a.Status })
    })
    .ToListAsync();

// ✅ Best: AsNoTracking for read-only queries
var jobs = await _context.Jobs
    .AsNoTracking()
    .Include(j => j.Applications)
    .ToListAsync();
```

**Spring Boot JPA:**

```java
// ❌ Bad: N+1 query
List<Job> jobs = jobRepository.findAll();
for (Job job : jobs) {
    List<Application> applications = applicationRepository.findByJobId(job.getId());
}

// ✅ Good: Use JOIN FETCH
@Query("SELECT j FROM Job j LEFT JOIN FETCH j.applications WHERE j.status = :status")
List<Job> findJobsWithApplications(@Param("status") String status);

// ✅ Better: Use DTO projection
@Query("SELECT new com.talentflow.dto.JobSummaryDTO(j.id, j.title, COUNT(a)) " +
       "FROM Job j LEFT JOIN j.applications a GROUP BY j.id, j.title")
List<JobSummaryDTO> findJobSummaries();

// ✅ Best: Pagination with specifications
Page<Job> jobs = jobRepository.findAll(
    JobSpecifications.hasStatus("PUBLISHED"),
    PageRequest.of(0, 20, Sort.by("createdAt").descending())
);
```

#### 3. Connection Pooling

**NestJS (Prisma):**

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL") // Append ?connection_limit=20
}

// app.module.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=20&pool_timeout=10',
    },
  },
});
```

**ASP.NET Core (EF Core):**

```csharp
// Program.cs
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(connectionString, npgsqlOptions =>
    {
        npgsqlOptions.MaxBatchSize(100);
        npgsqlOptions.CommandTimeout(30);
        npgsqlOptions.EnableRetryOnFailure(3);
    });
});

// Connection pooling (automatic in Npgsql)
// Adjust in connection string:
// "Host=localhost;Database=talentflow;MaxPoolSize=20;Timeout=30"
```

**Spring Boot (HikariCP):**

```yaml
# application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
      leak-detection-threshold: 60000
```

#### 4. Query Analysis

**EXPLAIN ANALYZE:**

```sql
-- Check query execution plan
EXPLAIN ANALYZE
SELECT j.*, COUNT(a.id) as application_count
FROM jobs j
LEFT JOIN applications a ON j.id = a.job_id
WHERE j.status = 'PUBLISHED'
GROUP BY j.id
ORDER BY j.created_at DESC
LIMIT 20;
```

**Look for:**
- ✅ `Index Scan` (fast)
- ❌ `Seq Scan` on large tables (slow - needs index)
- ❌ High `cost` values (> 1000)
- ❌ Nested Loop on large datasets (consider Hash Join)

---

## ⚡ Caching Strategy

### Caching Layers

```
┌─────────────────────────────────────┐
│  Layer 1: Client-Side Cache         │ (Browser, Service Worker)
│  TTL: 1 hour                        │
└─────────────────────────────────────┘
           ↓ Miss
┌─────────────────────────────────────┐
│  Layer 2: CDN Cache                 │ (Cloudflare)
│  TTL: 1 hour                        │
└─────────────────────────────────────┘
           ↓ Miss
┌─────────────────────────────────────┐
│  Layer 3: API Response Cache        │ (Redis)
│  TTL: 5-15 minutes                  │
└─────────────────────────────────────┘
           ↓ Miss
┌─────────────────────────────────────┐
│  Layer 4: Database Query Cache      │ (Application)
│  TTL: 1-10 minutes                  │
└─────────────────────────────────────┘
           ↓ Miss
┌─────────────────────────────────────┐
│  Database                           │
└─────────────────────────────────────┘
```

### What to Cache

| Data Type | TTL | Cache Layer | Invalidation Strategy |
|-----------|-----|-------------|----------------------|
| Static Assets (JS, CSS) | 1 year | CDN | Version/Hash in URL |
| Images | 1 month | CDN | Immutable URLs |
| Public API Responses | 5-15 min | Redis | Time-based |
| User Sessions | 24 hours | Redis | On logout |
| Job Listings | 5 min | Redis | On job update |
| User Profile | 10 min | Redis | On profile update |
| Database Query Results | 1-5 min | Application | On data mutation |

### Framework-Specific Caching

#### NestJS (Cache Manager)

```typescript
// Install: npm install @nestjs/cache-manager cache-manager
// Install: npm install cache-manager-redis-store

// app.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: 'localhost',
      port: 6379,
      ttl: 300, // 5 minutes default
    }),
  ],
})
export class AppModule {}

// cache.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = 300,
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.cacheManager.get<T>(key);
    if (cached) return cached;

    // If not cached, compute value
    const fresh = await factory();

    // Store in cache
    await this.cacheManager.set(key, fresh, ttl);

    return fresh;
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.cacheManager.store.keys(pattern);
    await Promise.all(keys.map(key => this.cacheManager.del(key)));
  }
}

// Usage in controller
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  async findAll() {
    return this.cacheService.getOrSet(
      'jobs:published',
      () => this.jobsService.findPublished(),
      300, // 5 minutes
    );
  }

  @Post()
  async create(@Body() dto: CreateJobDto) {
    const job = await this.jobsService.create(dto);
    // Invalidate cache
    await this.cacheService.invalidate('jobs:*');
    return job;
  }
}
```

#### ASP.NET Core (Memory Cache + Redis)

```csharp
// Install: dotnet add package StackExchange.Redis
// Install: dotnet add package Microsoft.Extensions.Caching.StackExchangeRedis

// Program.cs
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "TalentFlow_";
});

// CacheService.cs
public class CacheService
{
    private readonly IDistributedCache _cache;
    private readonly ILogger<CacheService> _logger;

    public CacheService(IDistributedCache cache, ILogger<CacheService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public async Task<T?> GetOrSetAsync<T>(
        string key,
        Func<Task<T>> factory,
        TimeSpan? expiration = null) where T : class
    {
        // Try get from cache
        var cached = await _cache.GetStringAsync(key);
        if (cached != null)
        {
            _logger.LogDebug("Cache hit for key: {Key}", key);
            return JsonSerializer.Deserialize<T>(cached);
        }

        // Compute value
        _logger.LogDebug("Cache miss for key: {Key}", key);
        var fresh = await factory();

        // Store in cache
        var options = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiration ?? TimeSpan.FromMinutes(5)
        };

        await _cache.SetStringAsync(
            key,
            JsonSerializer.Serialize(fresh),
            options
        );

        return fresh;
    }

    public async Task RemoveAsync(string key)
    {
        await _cache.RemoveAsync(key);
    }
}

// Usage in controller
[ApiController]
[Route("api/[controller]")]
public class JobsController : ControllerBase
{
    private readonly JobService _jobService;
    private readonly CacheService _cacheService;

    [HttpGet]
    public async Task<ActionResult<List<Job>>> GetJobs()
    {
        return await _cacheService.GetOrSetAsync(
            "jobs:published",
            async () => await _jobService.GetPublishedJobsAsync(),
            TimeSpan.FromMinutes(5)
        );
    }

    [HttpPost]
    public async Task<ActionResult<Job>> CreateJob(CreateJobDto dto)
    {
        var job = await _jobService.CreateAsync(dto);
        // Invalidate cache
        await _cacheService.RemoveAsync("jobs:published");
        return CreatedAtAction(nameof(GetJob), new { id = job.Id }, job);
    }
}
```

#### Spring Boot (Caffeine + Redis)

```java
// Add to pom.xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-cache</artifactId>
</dependency>
<dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
</dependency>

// application.yml
spring:
  cache:
    type: caffeine
    caffeine:
      spec: maximumSize=500,expireAfterWrite=5m

// CacheConfig.java
@Configuration
@EnableCaching
public class CacheConfig {
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager("jobs", "candidates");
        cacheManager.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .maximumSize(500)
            .recordStats());
        return cacheManager;
    }
}

// JobService.java
@Service
public class JobService {
    @Cacheable(value = "jobs", key = "'published'")
    public List<Job> getPublishedJobs() {
        return jobRepository.findByStatus("PUBLISHED");
    }

    @CacheEvict(value = "jobs", allEntries = true)
    public Job createJob(CreateJobDto dto) {
        return jobRepository.save(dto.toEntity());
    }

    @Cacheable(value = "jobs", key = "#id")
    public Job getJobById(String id) {
        return jobRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Job not found"));
    }
}
```

### Cache Invalidation Strategies

**1. Time-Based (TTL):**
```
Cache for 5 minutes, auto-expire
```

**2. Write-Through:**
```
Update cache when updating database
```

**3. Write-Behind:**
```
Update cache immediately, update database async
```

**4. Event-Based:**
```typescript
// When job is updated, invalidate cache
eventEmitter.emit('job.updated', jobId);

eventEmitter.on('job.updated', async (jobId) => {
  await cacheService.invalidate(`job:${jobId}`);
  await cacheService.invalidate('jobs:published');
});
```

---

## 🚀 API Gateway Optimization

### 1. Rate Limiting

**NestJS (Throttler):**

```typescript
// Install: npm install @nestjs/throttler

// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // 60 seconds
      limit: 100,   // 100 requests per ttl
    }),
  ],
})
export class AppModule {}

// Apply globally
app.useGlobalGuards(new ThrottlerGuard());

// Custom rate limit per endpoint
@Controller('auth')
export class AuthController {
  @Throttle(5, 60)  // 5 requests per 60 seconds
  @Post('login')
  async login(@Body() dto: LoginDto) {
    // ...
  }
}
```

**ASP.NET Core (AspNetCoreRateLimit):**

```csharp
// Install: dotnet add package AspNetCoreRateLimit

// Program.cs
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(options =>
{
    options.EnableEndpointRateLimiting = true;
    options.GeneralRules = new List<RateLimitRule>
    {
        new RateLimitRule
        {
            Endpoint = "*",
            Period = "1m",
            Limit = 100
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/auth/login",
            Period = "1m",
            Limit = 5
        }
    };
});
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

app.UseIpRateLimiting();
```

### 2. Response Compression

**NestJS:**

```typescript
// Install: npm install compression

// main.ts
import * as compression from 'compression';

app.use(compression({
  threshold: 1024,      // Only compress > 1KB
  level: 6,             // Compression level (1-9, 6 is balanced)
  filter: (req, res) => {
    // Don't compress images, videos
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));
```

**ASP.NET Core:**

```csharp
// Program.cs
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<GzipCompressionProvider>();
    options.Providers.Add<BrotliCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
        new[] { "application/json" });
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

app.UseResponseCompression();
```

### 3. HTTP/2 Support

**NestJS (Express):**

```typescript
// main.ts
import * as https from 'https';
import * as fs from 'fs';

const httpsOptions = {
  key: fs.readFileSync('./secrets/private-key.pem'),
  cert: fs.readFileSync('./secrets/certificate.pem'),
  allowHTTP1: true,  // Fallback to HTTP/1.1
};

const server = https.createServer(httpsOptions, app.getHttpAdapter().getInstance());
await server.listen(3000);
```

**ASP.NET Core:**

```csharp
// appsettings.json
{
  "Kestrel": {
    "Endpoints": {
      "Https": {
        "Url": "https://localhost:5001",
        "Protocols": "Http1AndHttp2"
      }
    }
  }
}
```

### 4. Connection Keep-Alive

```typescript
// NestJS
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=5, max=100');
  next();
});
```

---

## 🔧 CV Parser Optimization

### 1. Parallel Processing (Spring Boot)

```java
// CvParserConfig.java
@Configuration
@EnableAsync
public class CvParserConfig {
    @Bean
    public TaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("cv-parser-");
        executor.initialize();
        return executor;
    }
}

// CvParserService.java
@Service
public class CvParserService {
    @Async
    public CompletableFuture<ParsedCV> parseCv(byte[] pdfBytes) {
        // Parse PDF in separate thread
        String text = pdfBoxService.extractText(pdfBytes);
        Map<String, Object> structured = llmService.parse(text);
        return CompletableFuture.completedFuture(new ParsedCV(structured));
    }

    public void processBatch(List<String> cvIds) {
        List<CompletableFuture<ParsedCV>> futures = cvIds.stream()
            .map(this::parseCv)
            .collect(Collectors.toList());

        // Wait for all to complete
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    }
}
```

### 2. Parallel Processing (ASP.NET Core)

```csharp
// CvParserService.cs
public class CvParserService
{
    private readonly SemaphoreSlim _semaphore = new(4); // Max 4 parallel

    public async Task<ParsedCv> ParseCvAsync(byte[] pdfBytes)
    {
        await _semaphore.WaitAsync();
        try
        {
            var text = await _pdfService.ExtractTextAsync(pdfBytes);
            var structured = await _llmService.ParseAsync(text);
            return new ParsedCv(structured);
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task ProcessBatchAsync(List<string> cvIds)
    {
        var tasks = cvIds.Select(ParseCvAsync);
        await Task.WhenAll(tasks);
    }
}
```

### 3. Batch LLM Requests

```typescript
// Instead of 1 API call per CV
for (const cv of cvs) {
  await openai.parse(cv); // 100 CVs = 100 API calls 💰
}

// Batch process (5 CVs per API call)
const batches = chunk(cvs, 5);
for (const batch of batches) {
  await openai.parseBatch(batch); // 100 CVs = 20 API calls 💰
}
```

### 4. Memory Management

```java
// Process large PDFs in chunks to avoid OOM
@Service
public class PdfParserService {
    public String extractText(InputStream pdfStream) {
        try (PDDocument document = PDDocument.load(pdfStream)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setStartPage(1);
            stripper.setEndPage(10); // Process max 10 pages
            return stripper.getText(document);
        }
    }
}
```

---

## 💻 Frontend Performance

### Core Web Vitals Targets

| Metric | Target | Tool |
|--------|--------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Lighthouse |
| **FID** (First Input Delay) | < 100ms | Real User Monitoring |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| **TTFB** (Time to First Byte) | < 600ms | WebPageTest |
| **FCP** (First Contentful Paint) | < 1.8s | Lighthouse |

### Next.js 16 Optimizations

```typescript
// 1. Use Server Components by default
// app/jobs/page.tsx
export default async function JobsPage() {
  const jobs = await getJobs(); // Runs on server
  return <JobList jobs={jobs} />;
}

// 2. Dynamic imports for heavy components
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  loading: () => <p>Loading editor...</p>,
  ssr: false, // Don't render on server
});

// 3. Image optimization
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="TalentFlow"
  width={200}
  height={50}
  priority // Load above-the-fold images first
  placeholder="blur"
/>

// 4. Route prefetching
import Link from 'next/link';

<Link href="/jobs" prefetch={true}>
  View Jobs
</Link>

// 5. Streaming with Suspense
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <JobList />
    </Suspense>
  );
}
```

### Bundle Size Optimization

```javascript
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Analyze bundle size
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
    }
    return config;
  },

  // Tree-shaking
  experimental: {
    optimizePackageImports: ['lodash', 'date-fns'],
  },
};

// Tree-shake lodash
// ❌ Bad: Imports entire library (24KB)
import _ from 'lodash';
_.debounce(fn, 300);

// ✅ Good: Import only what you need
import debounce from 'lodash/debounce';
debounce(fn, 300);
```

**Target Bundle Sizes:**
- Initial JS bundle: < 200KB gzipped
- Total page weight: < 1MB
- Number of requests: < 50

---

## 🌐 Network Optimization

### 1. CDN Configuration (Cloudflare)

```javascript
// Set cache headers
app.use((req, res, next) => {
  if (req.url.startsWith('/static')) {
    // Cache static assets for 1 year
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (req.url.startsWith('/api')) {
    // API responses: cache for 5 minutes
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
  }
  next();
});
```

### 2. API Response Pagination

```typescript
// Cursor-based pagination (better for performance)
interface PaginationParams {
  cursor?: string;
  limit: number;
}

async function getJobs(params: PaginationParams) {
  const jobs = await prisma.job.findMany({
    take: params.limit + 1, // Fetch 1 extra to check if more exist
    cursor: params.cursor ? { id: params.cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = jobs.length > params.limit;
  const items = hasMore ? jobs.slice(0, -1) : jobs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}
```

### 3. GraphQL DataLoader (N+1 Prevention)

```typescript
// Install: npm install dataloader

// jobLoader.ts
import DataLoader from 'dataloader';

const jobLoader = new DataLoader(async (jobIds: string[]) => {
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds } },
  });

  // Return in same order as requested
  return jobIds.map(id => jobs.find(job => job.id === id));
});

// resolver.ts
@ResolveField()
async job(@Parent() application: Application) {
  return jobLoader.load(application.jobId); // Batches requests
}
```

---

## 📊 Monitoring & Profiling

### Application Profiling Tools

| Framework | Tool | Usage |
|-----------|------|-------|
| **NestJS** | clinic.js | `clinic doctor -- node dist/main.js` |
| **NestJS** | 0x | `0x -- node dist/main.js` |
| **Spring Boot** | JProfiler | Attach to running process |
| **Spring Boot** | VisualVM | `jvisualvm` |
| **ASP.NET Core** | dotnet-trace | `dotnet-trace collect -p <PID>` |
| **ASP.NET Core** | BenchmarkDotNet | Unit test benchmarking |
| **Database** | EXPLAIN ANALYZE | `EXPLAIN ANALYZE SELECT ...` |

### Continuous Performance Monitoring

**NestJS (Custom Metrics):**

```typescript
import { Histogram } from 'prom-client';

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpDuration.observe(
      { method: req.method, route: req.route?.path, status: res.statusCode },
      duration
    );
  });
  next();
});
```

---

## 💰 Performance Budget

### CI/CD Performance Checks

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on: [pull_request]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run k6 baseline test
        run: k6 run --out json=results.json k6/baseline.js

      - name: Check performance budget
        run: |
          P95=$(jq '.metrics.http_req_duration.values.p95' results.json)
          if (( $(echo "$P95 > 200" | bc -l) )); then
            echo "Performance regression: p95 latency is ${P95}ms (threshold: 200ms)"
            exit 1
          fi

      - name: Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
```

**Lighthouse CI Budget:**

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "interactive": ["error", { "maxNumericValue": 3500 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }]
      }
    }
  }
}
```

---

## 📚 Summary & Checklist

### Performance Optimization Checklist

- [ ] **Load Testing**
  - [ ] Baseline test passed (10 VUs, 5 min)
  - [ ] Load test passed (50 VUs, 10 min)
  - [ ] Stress test completed (find breaking point)

- [ ] **Database**
  - [ ] Indexes created for frequent queries
  - [ ] N+1 queries eliminated
  - [ ] Connection pooling configured
  - [ ] Query times < 50ms (p95)

- [ ] **Caching**
  - [ ] Redis cache implemented
  - [ ] Cache hit rate > 70%
  - [ ] Invalidation strategy defined

- [ ] **API Gateway**
  - [ ] Rate limiting enabled
  - [ ] Response compression enabled
  - [ ] HTTP/2 support enabled

- [ ] **CV Parser**
  - [ ] Parallel processing implemented
  - [ ] Memory limits configured
  - [ ] Processing time < 10s (avg)

- [ ] **Frontend**
  - [ ] Core Web Vitals targets met
  - [ ] Bundle size < 200KB
  - [ ] Images optimized

- [ ] **Monitoring**
  - [ ] Prometheus metrics exposed
  - [ ] Grafana dashboards created
  - [ ] Performance alerts configured

### Next Steps

1. **Week 1:** Run baseline load tests
2. **Week 2:** Optimize database queries & add indexes
3. **Week 3:** Implement caching layer
4. **Week 4:** Optimize API Gateway
5. **Week 5:** Optimize CV Parser parallelization
6. **Week 6:** Frontend optimization (Core Web Vitals)
7. **Week 7:** Performance testing & tuning
8. **Week 8:** Production monitoring setup

---

**Questions?** See [MONITORING.md](./MONITORING.md) for observability setup.
