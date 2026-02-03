# Deployment Guide - TalentFlow AI

**Project:** TalentFlow AI
**Last Updated:** 2026-02-01
**Deployment Stack:** Vercel (Frontend) + Railway (Backend) + Managed Services

---

## 📋 Table of Contents

- [Overview](#overview)
- [Deployment Architecture](#deployment-architecture)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Setup](#environment-setup)
- [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
- [Backend Deployment (Railway)](#backend-deployment-railway)
- [Database Setup (Neon)](#database-setup-neon)
- [BullMQ Setup (Redis)](#bullmq-setup-redis)
- [Monitoring Setup](#monitoring-setup)
- [Post-Deployment Verification](#post-deployment-verification)
- [Rollback Procedure](#rollback-procedure)

---

## 🎯 Overview

### Deployment Strategy

**Philosophy:** Deploy early, deploy often
- **Staging:** Deploy mỗi PR merge → `develop` branch
- **Production:** Deploy mỗi release tag → `main` branch

### Deployment Timeline

| Week | Environment | Purpose |
|------|-------------|---------|
| **Week 2** | Vercel (Frontend) | Demo #1 - UI prototype |
| **Week 4** | Railway (Backend) + Neon | Demo #2 - Working API |
| **Week 6** | Full stack + BullMQ | Demo #3 - CV upload |
| **Week 8** | Production + Monitoring | Demo #4 - MVP launch |

---

## 🏗️ Deployment Architecture

### Infrastructure Diagram

```mermaid
graph TB
    %% Users
    Users[👥 End Users]

    %% CDN
    CDN[🌐 Cloudflare CDN<br/>Optional Edge Cache]

    %% Frontend
    subgraph "Vercel Edge Network"
        Frontend[🖥️ Frontend<br/>Next.js 16<br/>app.talentflow.ai]
    end

    %% Backend Services
    subgraph "Railway (US Region)"
        API[⚙️ API Gateway<br/>NestJS:3000<br/>api.talentflow.ai]
        Parser[🔧 CV Parser<br/>Spring Boot:8080 OR<br/>ASP.NET Core:5000]
        Notif[📬 Notification<br/>NestJS:3001 OR<br/>ASP.NET Core:5001]
        Redis[⚡ Redis<br/>:6379<br/>BullMQ + Cache]
    end

    %% Database
    subgraph "Neon (Serverless)"
        DB[(🗄️ PostgreSQL<br/>Prisma/EF Core)]
    end

    %% External Services
    subgraph "External Services"
        R2[☁️ Cloudflare R2<br/>CV Storage]
        Claude[🤖 Anthropic Claude<br/>AI API]
        SendGrid[📧 SendGrid<br/>Email]
    end

    %% Connections
    Users -->|HTTPS| CDN
    CDN -->|Cache Miss| Frontend
    Frontend -->|API Calls| API

    API -->|TCP| DB
    API -->|Pub/Sub| Redis
    API -->|Upload| R2

    Redis -->|Events| Parser
    Redis -->|Events| Notif

    Parser -->|Read| R2
    Parser -->|AI Requests| Claude
    Parser -->|Update| DB

    Notif -->|Send| SendGrid
    Notif -->|Read| DB
    Notif -->|WebSocket| Frontend

    %% Styling
    classDef frontend fill:#1168BD,stroke:#0B4884,color:#fff
    classDef service fill:#438DD5,stroke:#2E6295,color:#fff
    classDef storage fill:#6DB33F,stroke:#4D7F2C,color:#fff
    classDef external fill:#999999,stroke:#6B6B6B,color:#fff

    class Frontend frontend
    class API,Parser,Notif service
    class DB,Redis storage
    class R2,Claude,SendGrid,CDN external
```

### ASCII Architecture Diagram (Legacy)

```
┌─────────────────────────────────────────────────────┐
│                   PRODUCTION                        │
└─────────────────────────────────────────────────────┘

[Users/Clients]
      ↓
[Cloudflare CDN] (Optional)
      ↓
┌─────────────────────┐
│  Vercel             │ → Next.js 16 Frontend
│  app.talentflow.ai  │    - React Server Components
└─────────────────────┘    - Server Actions
      ↓ HTTPS
┌─────────────────────┐
│  Railway            │ → NestJS API Gateway
│  api.talentflow.ai  │    - REST API
└─────────────────────┘    - GraphQL (Phase 2)
      ↓                    - WebSocket Gateway
┌─────────────────────┐
│  Railway Redis      │ → BullMQ Queue + Cache
│  Serverless         │
└─────────────────────┘
      ↓
┌─────────────────────┐
│  Railway            │ → CV Parser (Spring Boot/ASP.NET)
│  (Background)       │    - CV Processing
└─────────────────────┘
      ↓
┌─────────────────────┐
│  Neon PostgreSQL    │ → Database (Prisma/EF Core)
│  Serverless         │
└─────────────────────┘

External Services:
├── Cloudflare R2         → File storage
├── Anthropic Claude      → AI API
└── SendGrid              → Email notifications
```

---

## ✅ Pre-Deployment Checklist

### Code Quality
- [ ] All tests pass (`npm run test`)
- [ ] Coverage > 80% (`npm run test:cov`)
- [ ] ESLint no errors (`npm run lint`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] E2E tests pass (`npm run test:e2e`)

### Security
- [ ] No secrets in code (check `.env` in `.gitignore`)
- [ ] JWT_SECRET is strong and unique
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] File upload validation active

### Database
- [ ] Migrations tested locally
- [ ] Seed data ready (optional)
- [ ] Backup strategy documented
- [ ] Indexes created

### Documentation
- [ ] API_REFERENCE.md updated
- [ ] CHANGELOG.md updated
- [ ] Environment variables documented

---

## 🌍 Environment Setup

### Environment Types

| Environment | Branch | Auto-Deploy | Purpose |
|-------------|--------|-------------|---------|
| **Development** | `develop` | ✅ Yes | Team testing |
| **Staging** | `develop` | ✅ Yes | Client demos |
| **Production** | `main` | ⚠️ Manual | Live users |

### Repositories

1. **Frontend:** `talentflow-frontend`
   - Deploy to: **Vercel**
   - URL: https://app.talentflow.ai

2. **Backend:** `talentflow-backend`
   - Deploy to: **Railway**
   - URL: https://api.talentflow.ai

---

## 🎨 Frontend Deployment (Vercel)

### Step 1: Signup Vercel

1. Đi tới [vercel.com](https://vercel.com)
2. Signup với GitHub account
3. Import repository: `talentflow-frontend`

### Step 2: Configure Project

**Build Settings:**
```
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

**Environment Variables:**
```bash
NEXT_PUBLIC_API_URL=https://api.talentflow.ai
NEXT_PUBLIC_WS_URL=wss://api.talentflow.ai
NEXT_PUBLIC_ENV=production
```

### Step 3: Deploy

```bash
# Option 1: Auto-deploy (Recommended)
git push origin main
# Vercel tự động deploy

# Option 2: Manual deploy via CLI
npm install -g vercel
vercel login
vercel --prod
```

### Step 4: Configure Domain

1. Go to Vercel Dashboard → Settings → Domains
2. Add domain: `app.talentflow.ai`
3. Update DNS:
   ```
   Type: CNAME
   Name: app
   Value: cname.vercel-dns.com
   ```
4. Wait for SSL certificate (auto, ~1 min)

### Step 5: Verify

```bash
# Test deployment
curl https://app.talentflow.ai

# Expected: Next.js app loads
```

---

## 🚂 Backend Deployment (Railway)

### Step 1: Signup Railway

1. Đi tới [railway.app](https://railway.app)
2. Signup với GitHub account
3. Create new project: "TalentFlow Backend"

### Step 2: Deploy API Gateway

**Add Service:**
1. Click "New Service" → "GitHub Repo"
2. Select: `talentflow-backend`
3. Root Directory: `/apps/api-gateway` (nếu monorepo)

**Build Configuration:**
```json
// railway.json (in apps/api-gateway/)
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "node dist/apps/api-gateway/main.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Environment Variables:**
```bash
# Railway Dashboard → Variables
DATABASE_URL=${{Neon.DATABASE_URL}}
REDIS_URL=${{Upstash.REDIS_URL}}
KAFKA_BROKERS=${{Upstash.KAFKA_BROKER}}
JWT_SECRET=<generate-strong-secret>
PORT=3000
NODE_ENV=production
```

### Step 3: Deploy AI Worker

**Add Another Service:**
1. Same repo: `talentflow-backend`
2. Root Directory: `/apps/ai-worker`

**Start Command:**
```bash
node dist/apps/ai-worker/main.js
```

### Step 4: Configure Custom Domain

1. Railway Dashboard → Settings → Domains
2. Add domain: `api.talentflow.ai`
3. Update DNS:
   ```
   Type: CNAME
   Name: api
   Value: <railway-subdomain>.up.railway.app
   ```

### Step 5: Deploy

```bash
# Option 1: Auto-deploy from GitHub (Recommended)
git push origin main
# Railway tự động build & deploy

# Option 2: Railway CLI
npm install -g @railway/cli
railway login
railway link
railway up
```

---

## 🗄️ Database Setup (Neon)

### Step 1: Create Neon Project

1. Đi tới [neon.tech](https://neon.tech)
2. Signup (Free tier: 0.5 GB storage)
3. Create project: "TalentFlow AI"
4. Select region: US East (gần Railway)

### Step 2: Get Connection String

```bash
# Neon Dashboard → Connection String
postgresql://user:password@ep-example-123456.us-east-1.aws.neon.tech/talentflow?sslmode=require
```

### Step 3: Add to Railway

```bash
# Railway → Variables
DATABASE_URL=postgresql://user:password@ep-example.neon.tech/talentflow?sslmode=require
```

### Step 4: Run Migrations

```bash
# Railway CLI
railway run npx prisma migrate deploy

# Or via Railway Dashboard
# Add to build command: npx prisma migrate deploy && npm run build
```

### Step 5: Verify Connection

```bash
# SSH into Railway service
railway run npx prisma db pull

# Expected: Schema synced successfully
```

---

## 📨 BullMQ Setup (Redis Queue)

### Step 1: Use Railway Redis Add-on

**Option 1: Railway Redis (Recommended)**
```bash
# Railway Dashboard → Project → Add Service → Redis
# Redis instance created automatically with connection URL
```

**Option 2: Upstash Redis (Alternative)**
1. Đi tới [upstash.com](https://upstash.com)
2. Create Redis database
3. Region: US East (same as Railway)
4. Plan: Free tier (10K commands/day)

### Step 2: Get Redis URL

```bash
# Railway Redis:
REDIS_URL=redis://:password@redis.railway.internal:6379

# Or Upstash Redis:
REDIS_URL=rediss://default:token@redis.upstash.io:6379
```

### Step 3: Add to Railway Environment Variables

```bash
# Railway → Variables (All services)
REDIS_URL=${{Redis.REDIS_URL}}
```

### Step 4: BullMQ Auto-Configuration

BullMQ automatically creates queues on first use. No manual topic creation needed!

**Queues created automatically:**
- `cv.uploaded` - When CV is uploaded
- `cv.processed` - When CV parsing completes

### Step 5: Monitor Queues (Optional)

**Install Bull Board dashboard:**
```typescript
// api-gateway/src/main.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [
    new BullMQAdapter(cvUploadedQueue),
    new BullMQAdapter(cvProcessedQueue),
  ],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

**Access:** http://localhost:3000/admin/queues

---

## 📊 Monitoring Setup

### Option 1: Railway Built-in (Minimal)

**Included Free:**
- ✅ CPU/Memory metrics
- ✅ Request logs
- ✅ Deployment logs

**Access:** Railway Dashboard → Observability

---

### Option 2: ELK Stack (Recommended)

#### Setup Elasticsearch + Kibana

**Using Elastic Cloud (Managed):**
1. Signup at [elastic.co/cloud](https://elastic.co/cloud)
2. Create deployment (14-day free trial)
3. Get credentials

**Or Self-Hosted (Docker):**
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - 9200:9200

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - 5601:5601
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    ports:
      - 5000:5000
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
```

#### Configure NestJS Logging

```typescript
// main.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

const app = await NestFactory.create(AppModule, {
  logger: WinstonModule.createLogger({
    transports: [
      new winston.transports.Console(),
      new ElasticsearchTransport({
        level: 'info',
        clientOpts: {
          node: process.env.ELASTICSEARCH_URL,
        },
      }),
    ],
  }),
});
```

---

### Option 3: Prometheus + Grafana

#### Setup Prometheus

```yaml
# docker-compose.monitoring.yml (continued)
  prometheus:
    image: prom/prometheus:latest
    ports:
      - 9090:9090
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
```

**prometheus.yml:**
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'nestjs-api'
    static_configs:
      - targets: ['api.talentflow.ai:3000']
    metrics_path: '/metrics'
```

#### Setup Grafana

```yaml
  grafana:
    image: grafana/grafana:latest
    ports:
      - 3001:3000
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
```

**Access Grafana:**
- URL: http://localhost:3001
- Login: admin / admin
- Add Prometheus datasource
- Import dashboard: NestJS template

#### Add Metrics to NestJS

```bash
npm install @willsoto/nestjs-prometheus prom-client
```

```typescript
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
```

---

## 🔐 Environment Variables Setup

### Frontend (Vercel)

```bash
# Vercel Dashboard → Settings → Environment Variables

# API URLs
NEXT_PUBLIC_API_URL=https://api.talentflow.ai
NEXT_PUBLIC_WS_URL=wss://api.talentflow.ai

# Environment
NEXT_PUBLIC_ENV=production
```

### Backend (Railway)

```bash
# Railway Dashboard → Variables

# Application
NODE_ENV=production
PORT=3000

# Database (Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/talentflow?sslmode=require

# JWT
JWT_SECRET=<generate-with-openssl-rand-base64-64>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Kafka (Upstash)
KAFKA_BROKERS=creative-fox-12345-us1-kafka.upstash.io:9092
KAFKA_USERNAME=Y3JlYXRpdmUtZm94...
KAFKA_PASSWORD=YourStrongPasswordHere
KAFKA_SASL_MECHANISM=SCRAM-SHA-256

# Redis (Upstash)
REDIS_URL=rediss://default:token@us1-token-12345.upstash.io:6379

# S3 (AWS)
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=<your-secret-key>
S3_BUCKET=talentflow-prod-cvs
S3_REGION=us-east-1

# OpenAI (Phase 2)
OPENAI_API_KEY=sk-...

# Monitoring
ELASTICSEARCH_URL=https://elastic-cluster.es.io:9200
SENTRY_DSN=https://xxx@sentry.io/xxx

# CORS
CORS_ORIGIN=https://app.talentflow.ai,https://www.talentflow.ai

# Frontend URL
FRONTEND_URL=https://app.talentflow.ai
```

---

## 🚀 Deployment Steps

### Week 2: Frontend Prototype

```bash
# 1. Push code to GitHub
git add .
git commit -m "feat: initial frontend prototype"
git push origin main

# 2. Vercel auto-deploys
# Check: https://app.talentflow.ai

# 3. Share demo link với khách hàng
```

---

### Week 4: Backend + Database

#### A. Setup Neon Database

```bash
# 1. Create Neon project (Web UI)
# 2. Copy connection string
# 3. Add to Railway variables

# 4. Run migrations
railway login
railway link <project-id>
railway run npx prisma migrate deploy

# 5. Seed data (optional)
railway run npx prisma db seed
```

#### B. Deploy Backend to Railway

```bash
# 1. Connect Railway to GitHub
# Via Railway Dashboard → New Project → Deploy from GitHub

# 2. Configure build
# Railway auto-detects NestJS

# 3. Add environment variables
# See section above

# 4. Deploy
git push origin main
# Railway auto-deploys

# 5. Check health
curl https://api.talentflow.ai/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-01T10:00:00Z",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

---

### Week 6: Kafka + AI Worker

#### A. Setup Upstash Kafka

```bash
# 1. Create cluster (Web UI)
# 2. Create topics:
#    - cv.uploaded
#    - cv.processed
# 3. Copy credentials to Railway
```

#### B. Deploy AI Worker

```bash
# Railway → Add New Service
# Select same repo: talentflow-backend
# Root directory: /apps/ai-worker

# Start command:
node dist/apps/ai-worker/main.js

# Deploy
git push origin main
```

#### C. Test Kafka Pipeline

```bash
# Upload a test CV via frontend
# Watch Railway logs for AI Worker:
railway logs --service ai-worker --follow

# Expected logs:
[Kafka] Consumed message from cv.uploaded
[Parser] Extracting text from PDF...
[Parser] Text extracted: 1250 characters
[Kafka] Published message to cv.processed
```

---

### Week 8: Production Launch

#### Final Checklist

- [ ] All features tested
- [ ] 80%+ test coverage achieved
- [ ] Security audit completed (SECURITY.md checklist)
- [ ] Performance tested (load test)
- [ ] Monitoring dashboards configured
- [ ] Backup tested (restore from backup)
- [ ] Rollback procedure documented
- [ ] Customer demo successful
- [ ] Documentation complete

#### Go-Live Steps

```bash
# 1. Create release tag
git tag -a v1.0.0 -m "MVP Release"
git push origin v1.0.0

# 2. Deploy to production
# (Already auto-deployed from main branch)

# 3. Smoke tests
curl https://api.talentflow.ai/health
curl https://app.talentflow.ai

# 4. Monitor for 24 hours
# Watch logs, metrics, error rates

# 5. Announce to users
```

---

## 🔍 Post-Deployment Verification

### Health Checks

```bash
# 1. API Health
curl https://api.talentflow.ai/health

# Expected: { "status": "ok" }

# 2. Database Connection
curl https://api.talentflow.ai/api/v1/jobs

# Expected: Job list (may be empty)

# 3. Kafka Status
# Railway logs should show: [Kafka] Connected to broker

# 4. Frontend Loads
curl -I https://app.talentflow.ai

# Expected: HTTP/2 200
```

### Functional Tests

```bash
# Test complete flow:

# 1. Signup
curl -X POST https://api.talentflow.ai/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"SecurePass123!","fullName":"Test User"}'

# 2. Login
curl -X POST https://api.talentflow.ai/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"SecurePass123!"}'

# Save access token from response

# 3. Create Job
curl -X POST https://api.talentflow.ai/api/v1/jobs \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Job","description":"Test"}'

# Expected: Job created
```

---

## ⏮️ Rollback Procedure

### Scenario: Production Bug Detected

#### Option 1: Revert via Vercel (Frontend)

```bash
# Vercel Dashboard → Deployments
# Find previous working deployment
# Click "..." → Promote to Production

# Or via CLI:
vercel rollback
```

#### Option 2: Revert via Railway (Backend)

```bash
# Railway Dashboard → Deployments
# Select previous successful deployment
# Click "Redeploy"

# Or redeploy specific commit:
railway up --service api-gateway
```

#### Option 3: Git Revert

```bash
# Identify bad commit
git log --oneline

# Revert commit
git revert <commit-hash>
git push origin main

# Auto-deploys reverted code
```

### Database Rollback

**Prisma Migrations:**
```bash
# ⚠️ Prisma doesn't support automatic rollback

# Manual rollback:
# 1. Find migration folder
ls libs/database/prisma/migrations/

# 2. Apply previous migration manually
railway run psql $DATABASE_URL < previous_migration.sql
```

**Neon Point-in-Time Recovery:**
```bash
# Neon Dashboard → Backups
# Select timestamp before bug
# Restore to new branch
# Update DATABASE_URL to restored branch
```

---

## 📈 Monitoring & Alerting

### Key Metrics to Track

| Metric | Threshold | Action |
|--------|-----------|--------|
| **API Response Time (p95)** | < 500ms | Alert if > 1s |
| **Error Rate** | < 1% | Alert if > 5% |
| **CPU Usage** | < 70% | Alert if > 85% |
| **Memory Usage** | < 80% | Alert if > 90% |
| **Kafka Consumer Lag** | < 1000 msgs | Alert if > 5000 |
| **Database Connections** | < 80% pool | Alert if > 90% |

### Grafana Dashboards

**Dashboard 1: API Performance**
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate (%)
- Status code distribution

**Dashboard 2: Infrastructure**
- CPU usage (%)
- Memory usage (%)
- Database connections
- Kafka consumer lag

**Dashboard 3: Business Metrics**
- Active users
- Jobs created (per day)
- CVs uploaded (per day)
- Applications submitted

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
  - name: talentflow_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "Error rate > 5%"

      - alert: HighResponseTime
        expr: http_request_duration_seconds{quantile="0.95"} > 1
        for: 10m
        annotations:
          summary: "API response time > 1s"

      - alert: KafkaConsumerLag
        expr: kafka_consumer_lag > 5000
        for: 5m
        annotations:
          summary: "Kafka consumer lag > 5000 messages"
```

---

## 🔄 Continuous Deployment (CI/CD)

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:cov
      - run: npm run lint

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel
        run: echo "Vercel auto-deploys from GitHub"

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway
        run: echo "Railway auto-deploys from GitHub"

  migrate-database:
    needs: deploy-backend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npx prisma migrate deploy
```

---

## 💰 Cost Optimization

### Monthly Costs (Production)

| Service | Plan | Cost |
|---------|------|------|
| **Vercel** | Pro (if > 100GB bandwidth) | $20/mo |
| **Railway** | 2 services x $20 | $40/mo |
| **Neon** | Pro (> 3GB data) | $19/mo |
| **Upstash Kafka** | Pay-as-you-go | ~$10/mo |
| **Upstash Redis** | Pay-as-you-go | ~$10/mo |
| **AWS S3** | Storage + bandwidth | ~$10/mo |
| **Elastic Cloud** (Optional) | Basic | ~$50/mo |
| **Total** | | **~$159/mo** |

**Optimization Tips:**
- Use free tiers initially
- Monitor usage closely
- Optimize before scaling
- Consider self-hosted ELK if budget tight

---

## 🆘 Troubleshooting

### Deployment Fails

```bash
# Check Railway logs
railway logs --service api-gateway

# Common issues:
# 1. Build error → Check build command
# 2. Start error → Check start command
# 3. Env vars missing → Verify all variables set
```

### Database Migration Fails

```bash
# Check migration status
railway run npx prisma migrate status

# Reset migrations (CAUTION: loses data)
railway run npx prisma migrate reset --force

# Apply specific migration
railway run npx prisma migrate deploy
```

### Kafka Connection Fails

```bash
# Test Kafka connection
railway run node -e "console.log(process.env.KAFKA_BROKERS)"

# Check credentials
# Verify SASL mechanism matches Upstash settings
```

---

## 📞 Support & Escalation

### On-Call Rotation (Phase 2)
- **Week 1-2:** Developer 1
- **Week 3-4:** Developer 2
- Rotate every 2 weeks

### Incident Response
1. **P0 (Critical):** Service down → Fix ASAP (< 1 hour)
2. **P1 (High):** Major bug → Fix within 4 hours
3. **P2 (Medium):** Minor bug → Fix within 24 hours
4. **P3 (Low):** Enhancement → Next sprint

### Contacts
- **Tech Support:** tech@talentflow.ai
- **Security:** security@talentflow.ai
- **On-Call:** [PagerDuty or phone number]

---

## 📚 Related Documentation

- [ADR-004: Deployment Strategy](./adr/ADR-004-deployment-strategy.md)
- [SECURITY.md](./SECURITY.md) - Security checklist
- [TEAM_DECISIONS.md](./TEAM_DECISIONS.md) - Roadmap & timeline

---

**Last Updated:** 2026-02-01
**Next Review:** After MVP Launch (Week 8)
