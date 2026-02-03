# Monitoring & Observability Guide - TalentFlow AI

**Project:** TalentFlow AI Backend
**Last Updated:** 2026-02-03
**Architecture:** Polyglot 3-Service (NestJS + Spring Boot/ASP.NET Core)
**Monitoring Stack:** ELK + Prometheus + Grafana

---

## 📋 Table of Contents

- [Overview](#overview)
- [Monitoring Strategy](#monitoring-strategy)
- [ELK Stack Setup](#elk-stack-setup)
- [Prometheus Configuration](#prometheus-configuration)
- [Grafana Dashboards](#grafana-dashboards)
- [Application Logging](#application-logging)
- [Distributed Tracing](#distributed-tracing)
- [Health Checks](#health-checks)
- [Alerting Rules](#alerting-rules)
- [Incident Response](#incident-response)
- [Cost Monitoring](#cost-monitoring)

---

## 🎯 Overview

### Why Monitoring Matters

For a **Polyglot 3-Service Architecture**, comprehensive monitoring is critical:
- **Early Detection:** Catch issues before users report them
- **Performance Optimization:** Identify bottlenecks across different tech stacks
- **SLA Compliance:** Ensure 99%+ uptime for production
- **Debugging:** Trace requests across NestJS, Spring Boot, and ASP.NET services

### Monitoring Layers

```
┌─────────────────────────────────────────┐
│  Layer 1: Infrastructure Metrics       │
│  (CPU, Memory, Disk, Network)          │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  Layer 2: Application Metrics          │
│  (Request Rate, Latency, Errors)       │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  Layer 3: Business Metrics             │
│  (CVs Processed, Jobs Created)         │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  Layer 4: Logs & Traces                │
│  (Request Logs, Error Traces)          │
└─────────────────────────────────────────┘
```

---

## 📊 Monitoring Strategy

### Framework-Agnostic Principles

Regardless of your tech stack (NestJS, Spring Boot, ASP.NET Core), follow these principles:

1. **Golden Signals** (Google SRE):
   - **Latency:** How long does it take?
   - **Traffic:** How much demand?
   - **Errors:** What's failing?
   - **Saturation:** How full is the system?

2. **USE Method** (for resources):
   - **Utilization:** % of time busy
   - **Saturation:** Queue depth
   - **Errors:** Error count

3. **RED Method** (for services):
   - **Rate:** Requests per second
   - **Errors:** Failed requests
   - **Duration:** Request latency

### Key Metrics to Track

| Service | Metric | Target | Tool |
|---------|--------|--------|------|
| **API Gateway** | Response Time (p95) | < 200ms | Prometheus |
| **API Gateway** | Throughput (RPS) | 100+ | Prometheus |
| **API Gateway** | Error Rate | < 1% | Prometheus |
| **CV Parser** | Processing Time | < 10s | Application Logs |
| **CV Parser** | Queue Lag | < 5 msgs | BullMQ Dashboard |
| **Notification** | WebSocket Connections | Monitor | Prometheus |
| **Database** | Query Time (p95) | < 50ms | Prisma/EF Metrics |
| **Database** | Connection Pool | < 80% | Postgres Exporter |
| **Redis** | Memory Usage | < 1GB | Redis Exporter |
| **System** | CPU Usage | < 70% | Node Exporter |
| **System** | Memory Usage | < 85% | Node Exporter |

---

## 🔍 ELK Stack Setup

### Architecture

```
Applications → Filebeat → Logstash → Elasticsearch ← Kibana
```

### Docker Compose Setup

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    networks:
      - monitoring

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    container_name: logstash
    ports:
      - "5000:5000"
      - "5044:5044"
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
      - ./logstash/config:/usr/share/logstash/config
    depends_on:
      - elasticsearch
    networks:
      - monitoring

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
    networks:
      - monitoring

volumes:
  elasticsearch-data:

networks:
  monitoring:
    driver: bridge
```

### Logstash Pipeline Configuration

```ruby
# logstash/pipeline/logstash.conf
input {
  tcp {
    port => 5000
    codec => json
  }

  http {
    port => 5044
    codec => json
  }
}

filter {
  # Add service name from log
  if [service] {
    mutate {
      add_field => { "service_name" => "%{service}" }
    }
  }

  # Parse timestamp
  date {
    match => [ "timestamp", "ISO8601" ]
  }

  # Add severity level
  if [level] == "error" {
    mutate {
      add_tag => [ "error" ]
      add_field => { "severity" => "high" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["http://elasticsearch:9200"]
    index => "talentflow-%{service_name}-%{+YYYY.MM.dd}"
  }

  # Debug output (remove in production)
  stdout { codec => rubydebug }
}
```

### Index Patterns

**Kibana → Management → Index Patterns → Create:**

```
Pattern: talentflow-*
Time Field: @timestamp
```

**Index Examples:**
- `talentflow-api-gateway-2026.02.03`
- `talentflow-cv-parser-2026.02.03`
- `talentflow-notification-2026.02.03`

### Kibana Dashboard Queries

**1. Error Rate by Service (Last 24h):**
```
level: "error" AND timestamp:[now-24h TO now]
```

**2. Slow Requests (> 1s):**
```
duration: >1000 AND service_name: "api-gateway"
```

**3. Failed CV Parsing:**
```
message: "CV parsing failed" AND service_name: "cv-parser"
```

---

## 📈 Prometheus Configuration

### Docker Compose (Add to monitoring stack)

```yaml
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    networks:
      - monitoring

  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: redis-exporter
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis:6379
    networks:
      - monitoring
```

### Prometheus Configuration File

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# Load rules
rule_files:
  - "alerts.yml"

scrape_configs:
  # API Gateway (NestJS)
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:3000']
    metrics_path: '/metrics'

  # CV Parser (Spring Boot)
  - job_name: 'cv-parser-springboot'
    static_configs:
      - targets: ['cv-parser:8080']
    metrics_path: '/actuator/prometheus'

  # CV Parser (ASP.NET Core)
  - job_name: 'cv-parser-dotnet'
    static_configs:
      - targets: ['cv-parser:5000']
    metrics_path: '/metrics'

  # Notification Service (NestJS)
  - job_name: 'notification-nestjs'
    static_configs:
      - targets: ['notification:3001']
    metrics_path: '/metrics'

  # Notification Service (ASP.NET Core)
  - job_name: 'notification-dotnet'
    static_configs:
      - targets: ['notification:5001']
    metrics_path: '/metrics'

  # Node Exporter (System metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # Redis Exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### Framework-Specific Metrics Endpoints

#### NestJS (API Gateway & Notification)

```typescript
// Install: npm install @willsoto/nestjs-prometheus prom-client

// app.module.ts
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
})
export class AppModule {}

// metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly httpRequestsTotal: Counter<string>,

    @InjectMetric('http_request_duration_seconds')
    private readonly httpRequestDuration: Histogram<string>,
  ) {}

  recordRequest(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestsTotal.inc({ method, route, status: statusCode });
    this.httpRequestDuration.observe({ method, route }, duration / 1000);
  }
}
```

#### Spring Boot (CV Parser)

```java
// Add to pom.xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>

// application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus,metrics
  metrics:
    export:
      prometheus:
        enabled: true
  endpoint:
    prometheus:
      enabled: true

// Custom metrics
@Component
public class CvParserMetrics {
    private final Counter cvProcessedCounter;
    private final Timer cvProcessingTimer;

    public CvParserMetrics(MeterRegistry registry) {
        this.cvProcessedCounter = Counter.builder("cv_processed_total")
            .description("Total number of CVs processed")
            .tag("status", "success")
            .register(registry);

        this.cvProcessingTimer = Timer.builder("cv_processing_duration_seconds")
            .description("CV processing duration")
            .register(registry);
    }

    public void recordCvProcessed(String status) {
        cvProcessedCounter.increment();
    }

    public Timer.Sample startTimer() {
        return Timer.start();
    }

    public void recordDuration(Timer.Sample sample) {
        sample.stop(cvProcessingTimer);
    }
}
```

#### ASP.NET Core (CV Parser or Notification)

```csharp
// Install: dotnet add package prometheus-net.AspNetCore

// Program.cs
using Prometheus;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Enable Prometheus metrics
app.UseMetricServer(); // Exposes /metrics endpoint
app.UseHttpMetrics();  // Tracks HTTP metrics

app.Run();

// Custom metrics
public class CvParserMetrics
{
    private static readonly Counter CvProcessedCounter = Metrics
        .CreateCounter("cv_processed_total", "Total CVs processed");

    private static readonly Histogram CvProcessingDuration = Metrics
        .CreateHistogram("cv_processing_duration_seconds", "CV processing duration");

    public void RecordCvProcessed()
    {
        CvProcessedCounter.Inc();
    }

    public IDisposable MeasureDuration()
    {
        return CvProcessingDuration.NewTimer();
    }
}
```

---

## 📊 Grafana Dashboards

### Docker Compose (Add to monitoring stack)

```yaml
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus
    networks:
      - monitoring
```

### Pre-built Dashboard Templates

#### Dashboard 1: System Overview

```json
{
  "dashboard": {
    "title": "TalentFlow AI - System Overview",
    "panels": [
      {
        "title": "Request Rate (RPS)",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ],
        "type": "graph"
      },
      {
        "title": "CPU Usage",
        "targets": [
          {
            "expr": "100 - (avg by(instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)"
          }
        ],
        "type": "gauge"
      }
    ]
  }
}
```

#### Dashboard 2: API Gateway Performance

**PromQL Queries:**

```promql
# Request Rate by Endpoint
rate(http_requests_total{job="api-gateway"}[5m])

# p95 Latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="api-gateway"}[5m]))

# Error Rate
sum(rate(http_requests_total{job="api-gateway",status=~"5.."}[5m])) / sum(rate(http_requests_total{job="api-gateway"}[5m]))

# Active WebSocket Connections
websocket_connections_active
```

#### Dashboard 3: CV Parser Throughput

```promql
# CVs Processed per Minute
rate(cv_processed_total[1m]) * 60

# Average Processing Time
rate(cv_processing_duration_seconds_sum[5m]) / rate(cv_processing_duration_seconds_count[5m])

# Queue Lag
bullmq_queue_waiting_count
```

#### Dashboard 4: Database Performance

```promql
# Query Time (p95)
histogram_quantile(0.95, rate(prisma_query_duration_seconds_bucket[5m]))

# Connection Pool Utilization
pg_stat_database_numbackends / pg_settings_max_connections * 100

# Slow Queries (> 1s)
increase(prisma_query_duration_seconds_bucket{le="1"}[5m])
```

### Dashboard Variables

```
Service: $service
Environment: $env (dev, staging, prod)
Time Range: Last 1h, Last 24h, Last 7d
```

---

## 📝 Application Logging

### Structured Logging Format (JSON)

**Standard Log Structure:**
```json
{
  "timestamp": "2026-02-03T10:30:00Z",
  "level": "error",
  "service": "api-gateway",
  "message": "Database connection failed",
  "context": {
    "userId": "user_123",
    "requestId": "req_abc456",
    "route": "/api/v1/jobs"
  },
  "error": {
    "name": "DatabaseError",
    "message": "Connection timeout",
    "stack": "Error: Connection timeout..."
  }
}
```

### Framework-Specific Logging

#### NestJS (Winston Logger)

```typescript
// Install: npm install winston nest-winston

// logger.service.ts
import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new transports.Console(),
    new transports.Http({
      host: 'logstash',
      port: 5000,
      path: '/',
    }),
  ],
});

// Usage
logger.error('Database connection failed', {
  context: {
    userId: req.user.id,
    requestId: req.id,
    route: req.path,
  },
  error: {
    name: err.name,
    message: err.message,
    stack: err.stack,
  },
});
```

#### Spring Boot (Logback)

```xml
<!-- logback-spring.xml -->
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <customFields>{"service":"cv-parser"}</customFields>
        </encoder>
    </appender>

    <appender name="LOGSTASH" class="net.logstash.logback.appender.LogstashTcpSocketAppender">
        <destination>logstash:5000</destination>
        <encoder class="net.logstash.logback.encoder.LogstashEncoder" />
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE" />
        <appender-ref ref="LOGSTASH" />
    </root>
</configuration>
```

```java
// Usage
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import net.logstash.logback.argument.StructuredArguments;

private static final Logger logger = LoggerFactory.getLogger(CvParserService.class);

logger.error("CV parsing failed",
    StructuredArguments.kv("userId", userId),
    StructuredArguments.kv("cvId", cvId),
    StructuredArguments.kv("error", exception.getMessage())
);
```

#### ASP.NET Core (Serilog)

```csharp
// Install: dotnet add package Serilog.AspNetCore
// Install: dotnet add package Serilog.Sinks.Http

// Program.cs
using Serilog;

Log.Logger = new LoggerConfiguration()
    .Enrich.WithProperty("Service", "cv-parser")
    .WriteTo.Console(new JsonFormatter())
    .WriteTo.Http("http://logstash:5000", queueLimitBytes: null)
    .CreateLogger();

builder.Host.UseSerilog();

// Usage
Log.Error(exception, "CV parsing failed for {UserId} and {CvId}", userId, cvId);
```

### Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| **ERROR** | Requires immediate action | Database down, API call failed |
| **WARN** | Recoverable issue | Retry succeeded, deprecated API used |
| **INFO** | Normal operations | Request completed, job created |
| **DEBUG** | Development info | Query execution time, cache hit/miss |
| **TRACE** | Very detailed | Method entry/exit, variable values |

### Log Retention Policy

| Level | Retention | Storage |
|-------|-----------|---------|
| ERROR | 90 days | Elasticsearch hot tier |
| WARN | 30 days | Elasticsearch warm tier |
| INFO | 7 days | Elasticsearch cold tier |
| DEBUG | 1 day (dev only) | Local only |

---

## 🔗 Distributed Tracing

### OpenTelemetry Setup

**Why OpenTelemetry:**
- Framework-agnostic (works with NestJS, Spring Boot, ASP.NET)
- Industry standard
- Supports traces, metrics, and logs

### Architecture

```
Application → OpenTelemetry SDK → OTLP Exporter → Jaeger
```

### Docker Compose (Add Jaeger)

```yaml
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger
    ports:
      - "5775:5775/udp"
      - "6831:6831/udp"
      - "6832:6832/udp"
      - "5778:5778"
      - "16686:16686"  # Jaeger UI
      - "14268:14268"
      - "14250:14250"
      - "9411:9411"
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
    networks:
      - monitoring
```

### Framework-Specific Tracing

#### NestJS

```typescript
// Install: npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node

// tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: 'http://jaeger:14268/api/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'api-gateway',
});

sdk.start();
```

#### Spring Boot

```xml
<!-- Add to pom.xml -->
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-api</artifactId>
</dependency>
```

```yaml
# application.yml
management:
  tracing:
    sampling:
      probability: 1.0  # 100% sampling for dev
  zipkin:
    tracing:
      endpoint: http://jaeger:9411/api/v2/spans
```

#### ASP.NET Core

```csharp
// Install: dotnet add package OpenTelemetry.Extensions.Hosting
// Install: dotnet add package OpenTelemetry.Exporter.Jaeger

// Program.cs
builder.Services.AddOpenTelemetry()
    .WithTracing(tracerProviderBuilder =>
    {
        tracerProviderBuilder
            .AddSource("cv-parser")
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddJaegerExporter(options =>
            {
                options.AgentHost = "jaeger";
                options.AgentPort = 6831;
            });
    });
```

### Trace Attributes

**Standard Span Attributes:**
```
- http.method: GET, POST, PUT, DELETE
- http.url: /api/v1/jobs
- http.status_code: 200
- service.name: api-gateway
- span.kind: server, client, internal
```

**Custom Attributes:**
```typescript
span.setAttribute('user.id', userId);
span.setAttribute('cv.id', cvId);
span.setAttribute('processing.duration', duration);
```

---

## ✅ Health Checks

### Endpoint Specification

All services MUST expose health check endpoints:

| Service | Endpoint | Port |
|---------|----------|------|
| API Gateway (NestJS) | GET /health | 3000 |
| CV Parser (Spring Boot) | GET /actuator/health | 8080 |
| CV Parser (ASP.NET) | GET /health | 5000 |
| Notification (NestJS) | GET /health | 3001 |
| Notification (ASP.NET) | GET /health | 5001 |

### Health Check Response Format

```json
{
  "status": "healthy",
  "timestamp": "2026-02-03T10:30:00Z",
  "uptime": 86400,
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2
    },
    "cloudflare-r2": {
      "status": "healthy",
      "responseTime": 50
    }
  }
}
```

### Framework-Specific Implementation

#### NestJS (Terminus)

```typescript
// Install: npm install @nestjs/terminus

// health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator, DiskHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }
}
```

#### Spring Boot (Actuator)

```java
// Automatically provided by Spring Boot Actuator
// Just add dependency and configure

// application.yml
management:
  endpoints:
    web:
      exposure:
        include: health
  health:
    defaults:
      enabled: true
    db:
      enabled: true
    redis:
      enabled: true

// Custom health indicator
@Component
public class R2HealthIndicator implements HealthIndicator {
    @Override
    public Health health() {
        try {
            // Check R2 connection
            s3Client.headBucket(HeadBucketRequest.builder().bucket(bucketName).build());
            return Health.up().withDetail("bucket", bucketName).build();
        } catch (Exception e) {
            return Health.down().withException(e).build();
        }
    }
}
```

#### ASP.NET Core

```csharp
// Install: dotnet add package Microsoft.Extensions.Diagnostics.HealthChecks

// Program.cs
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString, name: "database")
    .AddRedis(redisConnection, name: "redis")
    .AddCheck<R2HealthCheck>("cloudflare-r2");

app.MapHealthChecks("/health");

// Custom health check
public class R2HealthCheck : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context)
    {
        try
        {
            // Check R2 connection
            await _s3Client.ListBucketsAsync();
            return HealthCheckResult.Healthy("R2 is accessible");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("R2 is not accessible", ex);
        }
    }
}
```

### Kubernetes Liveness & Readiness Probes

```yaml
# deployment.yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

---

## 🚨 Alerting Rules

### Prometheus Alert Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: service_alerts
    interval: 30s
    rules:
      # High Error Rate
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected in {{ $labels.job }}"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

      # Slow Response Time
      - alert: SlowResponseTime
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time in {{ $labels.job }}"
          description: "p95 latency is {{ $value }}s (threshold: 2s)"

      # Service Down
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "{{ $labels.instance }} has been down for more than 1 minute"

      # High CPU Usage
      - alert: HighCPUUsage
        expr: |
          100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is {{ $value }}% (threshold: 80%)"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: |
          (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100 > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage is {{ $value }}% (threshold: 85%)"

      # Queue Lag
      - alert: HighQueueLag
        expr: bullmq_queue_waiting_count > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High queue lag in BullMQ"
          description: "Queue has {{ $value }} waiting messages (threshold: 100)"

      # Database Connection Issues
      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_database_numbackends / pg_settings_max_connections * 100 > 90
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool near exhaustion"
          description: "Connection pool utilization is {{ $value }}%"
```

### Alertmanager Configuration

```yaml
# alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'team-alerts'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
    - match:
        severity: warning
      receiver: 'slack'

receivers:
  - name: 'team-alerts'
    slack_configs:
      - channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'

  - name: 'slack'
    slack_configs:
      - channel: '#monitoring'
```

### Notification Channels

| Severity | Channel | Response Time |
|----------|---------|---------------|
| **Critical** | PagerDuty + Slack | Immediate (24/7) |
| **Warning** | Slack | 1 hour (business hours) |
| **Info** | Email | Best effort |

---

## 🔥 Incident Response

### 5-Phase Incident Response Process

```
1. DETECT → 2. TRIAGE → 3. MITIGATE → 4. RESOLVE → 5. POST-MORTEM
```

### 1. Detection

**Automated:**
- Prometheus alerts trigger
- Error rate spikes in Grafana
- Health check failures

**Manual:**
- User reports
- Customer support tickets
- Social media mentions

### 2. Triage (MTTD - Mean Time To Detect)

**Severity Classification:**

| Severity | Impact | Examples | Response Time |
|----------|--------|----------|---------------|
| **P0 - Critical** | System down | All services unreachable | 15 minutes |
| **P1 - High** | Major feature broken | CV upload fails | 1 hour |
| **P2 - Medium** | Degraded performance | Slow response times | 4 hours |
| **P3 - Low** | Minor issue | Cosmetic bug | Next sprint |

**Incident Commander:**
- Declare incident severity
- Coordinate response team
- Update status page

### 3. Mitigation (MTTR - Mean Time To Repair)

**Immediate Actions:**
```bash
# 1. Check service status
curl https://api.talentflow.ai/health

# 2. Review recent logs
kubectl logs -l app=api-gateway --tail=100

# 3. Check metrics in Grafana
# Navigate to: http://grafana:3000

# 4. Rollback if recent deployment
kubectl rollout undo deployment/api-gateway
```

**Communication:**
- Post to #incidents Slack channel
- Update status page (status.talentflow.ai)
- Notify affected customers

### 4. Resolution

**Root Cause Analysis:**
- Review logs in Kibana
- Analyze traces in Jaeger
- Check metrics in Grafana
- Inspect database queries

**Fix Implementation:**
- Deploy hotfix
- Verify fix in staging
- Deploy to production
- Monitor for 30 minutes

### 5. Post-Mortem

**Post-Mortem Template:**

```markdown
# Incident Post-Mortem: [TITLE]

**Date:** 2026-02-03
**Duration:** 15 minutes
**Severity:** P1
**Impact:** CV upload unavailable for 500 users

## Timeline
- 10:00 AM: Alert triggered (high error rate)
- 10:02 AM: Incident declared (P1)
- 10:05 AM: Root cause identified (S3 timeout)
- 10:10 AM: Mitigation deployed (increased timeout)
- 10:15 AM: Incident resolved

## Root Cause
Cloudflare R2 experienced network latency spike, causing upload timeouts.

## Resolution
Increased upload timeout from 5s → 30s, added retry logic (3 attempts).

## Action Items
- [ ] Add R2 latency monitoring (Owner: DevOps, Due: Week 1)
- [ ] Implement circuit breaker for S3 (Owner: Backend, Due: Week 2)
- [ ] Add timeout alerts (Owner: SRE, Due: Week 1)

## Lessons Learned
- Need better external service monitoring
- Timeout values were too aggressive
- Missing fallback mechanism
```

---

## 💰 Cost Monitoring

### Cloud Cost Tracking

| Service | Monthly Cost | Usage Metric |
|---------|--------------|--------------|
| Railway (Backend) | $40 | CPU hours |
| Neon (Database) | $19 | Storage + Compute |
| Cloudflare R2 | $0.015/GB | Storage |
| Upstash Redis | $10 | Data transfer |
| Vercel (Frontend) | $20 | Bandwidth |
| Sentry | $26 | Events |
| **Total** | **~$115/month** | |

### Cost Optimization Strategies

1. **Database:**
   - Enable Neon autoscaling (scale to zero when idle)
   - Archive old data (> 90 days)
   - Use connection pooling (reduce connections)

2. **Storage:**
   - Set R2 lifecycle policies (delete temp files after 7 days)
   - Use object compression for large files
   - Implement CDN caching (reduce egress)

3. **Compute:**
   - Scale CV Parser based on queue depth
   - Use spot instances for non-critical workloads
   - Enable auto-sleep for staging environments

4. **Monitoring:**
   - Reduce log retention (7 days instead of 30)
   - Sample traces (10% instead of 100%)
   - Use free tier limits (Grafana Cloud free tier)

### Cost Alerts

```yaml
# Set up billing alerts
# AWS CloudWatch Billing
# Threshold: $150/month (30% over budget)
```

---

## 📚 Summary

### Monitoring Checklist

- [x] **Metrics Collection**
  - [x] Prometheus installed and configured
  - [x] All services expose /metrics endpoint
  - [x] Key business metrics tracked

- [x] **Logging**
  - [x] ELK Stack deployed
  - [x] Structured JSON logging implemented
  - [x] Log retention policies configured

- [x] **Visualization**
  - [x] Grafana dashboards created
  - [x] Alerts configured in Prometheus
  - [x] Alertmanager notification channels set up

- [x] **Tracing**
  - [x] Jaeger deployed
  - [x] OpenTelemetry instrumentation added
  - [x] Distributed tracing working

- [x] **Health Checks**
  - [x] All services expose /health endpoint
  - [x] Kubernetes probes configured
  - [x] Dependency checks implemented

- [x] **Alerting**
  - [x] Alert rules defined (error rate, latency, uptime)
  - [x] Notification channels configured (Slack, PagerDuty)
  - [x] On-call rotation established

- [x] **Incident Response**
  - [x] Runbook created
  - [x] Post-mortem template defined
  - [x] Escalation process documented

### Next Steps

1. **Week 1:** Deploy monitoring stack (ELK + Prometheus + Grafana)
2. **Week 2:** Instrument all services with metrics
3. **Week 3:** Create custom dashboards
4. **Week 4:** Configure alerts and test incident response
5. **Week 5:** Run chaos engineering tests
6. **Week 6:** Optimize monitoring based on production data

---

**Questions?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or contact DevOps team.
