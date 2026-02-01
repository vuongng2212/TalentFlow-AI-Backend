# ADR-004: Deployment Strategy - Vercel + Railway

**Status:** Accepted
**Date:** 2026-02-01
**Deciders:** Team (2 developers)

---

## Context

We need to deploy TalentFlow AI with:
- **Frontend**: Next.js 16 (separate repo)
- **Backend**: NestJS Monorepo (this repo)
- **Database**: PostgreSQL
- **Infrastructure**: Kafka, Redis, MinIO/S3

**Project Constraints:**
- 2-person team (limited DevOps time)
- MVP in 1-2 months
- Need fast iteration cycles
- Cost-conscious (startup budget)

**Options considered:**
1. **Vercel (Frontend) + Railway/Render (Backend)** - Managed platforms
2. **AWS (EC2 + RDS + S3)** - Full control, complex
3. **DigitalOcean App Platform** - Simple but limited
4. **Docker + VPS (Hetzner/Linode)** - Cost-effective but manual
5. **Kubernetes (GKE/EKS)** - Overkill for MVP

---

## Decision

We will use:
- **Frontend**: **Vercel** (Next.js 16)
- **Backend**: **Railway** (NestJS apps)
- **Database**: **Supabase** or **Neon** (Managed PostgreSQL)
- **Storage**: **AWS S3** (file uploads)
- **Kafka**: **Upstash Kafka** (Managed)
- **Redis**: **Upstash Redis** (Managed)

---

## Rationale

### Frontend: Why Vercel?

✅ **Pros:**
1. **Zero-Config**: Push to GitHub, auto-deploy
2. **Next.js Native**: Built by Next.js creators (Vercel)
3. **Edge Functions**: Built-in support
4. **Preview Deployments**: Every PR gets a preview URL
5. **Free Tier**: Generous free tier for MVP
6. **Performance**: Global CDN, optimized for Next.js

❌ **Cons:**
1. **Vendor Lock-in**: Tied to Vercel
2. **Cost**: Can get expensive at scale (but fine for MVP)

### Backend: Why Railway?

✅ **Pros:**
1. **Simple**: Deploy from GitHub with minimal config
2. **Monorepo Support**: Handles NestJS workspace well
3. **Environment Variables**: Easy management
4. **Logs & Metrics**: Built-in observability
5. **Pricing**: $5/month per service (predictable)
6. **Fast**: Quick deployment times

**Alternative: Render**
- Similar to Railway but slightly less polished UI
- Railway chosen for better DX

❌ **Cons:**
1. **Limited Customization**: Not as flexible as AWS
2. **Scaling Limits**: May need to migrate later

### Database: Why Supabase/Neon?

✅ **Pros:**
1. **Managed**: No database administration
2. **PostgreSQL**: Compatible with Prisma
3. **Free Tier**: Good for development
4. **Backups**: Automatic backups included
5. **Neon**: Serverless, scales to zero (cost-efficient)

**Choice:**
- **Development**: Supabase (more features)
- **Production**: Neon (better pricing at scale)

### Kafka: Why Upstash Kafka?

✅ **Pros:**
1. **Managed**: No Kafka administration
2. **Serverless**: Pay per request, not per instance
3. **REST API**: Easier to use than native Kafka protocol
4. **Free Tier**: 10K messages/day free

**Alternative: Run Kafka on Railway**
- ❌ Rejected: Too complex to manage for 2-person team

### Redis: Why Upstash Redis?

✅ **Pros:**
1. **Managed**: No Redis administration
2. **Serverless**: Pay per request
3. **Global**: Low latency worldwide
4. **Free Tier**: 10K commands/day free

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   PRODUCTION                        │
└─────────────────────────────────────────────────────┘

[Users]
  ↓
[Vercel CDN] → Next.js 16 Frontend
  ↓ API calls
[Railway] → NestJS API Gateway (app 1)
  ↓
[Upstash Kafka] → Events
  ↓
[Railway] → NestJS AI Worker (app 2)
  ↓
[Railway] → NestJS Notification (app 3)
  ↓
[Neon PostgreSQL] ← Prisma
[AWS S3] ← File uploads
[Upstash Redis] ← Caching
```

---

## Deployment Workflow

### Frontend (Vercel)

```yaml
# .github/workflows/frontend-deploy.yml
name: Deploy Frontend

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

**Result**: Push to `main` → Auto-deploy to Vercel

### Backend (Railway)

```yaml
# railway.json
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

**Services:**
1. `api-gateway` → Main API
2. `ai-worker` → CV processor
3. `notification` → WebSocket/Email

**Result**: Push to `main` → Auto-deploy all services

---

## Environment Variables

### Vercel (Frontend)

```bash
NEXT_PUBLIC_API_URL=https://api.talentflow.ai
NEXT_PUBLIC_WS_URL=wss://api.talentflow.ai
```

### Railway (Backend)

```bash
# Database
DATABASE_URL=postgresql://user:pass@db.neon.tech:5432/talentflow

# JWT
JWT_SECRET=super-secret-key-from-env
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Kafka (Upstash)
KAFKA_BROKER=creative-fox-12345.upstash.io:9092
KAFKA_USERNAME=username
KAFKA_PASSWORD=password

# Redis (Upstash)
REDIS_URL=rediss://default:token@redis.upstash.io:6379

# S3
S3_BUCKET=talentflow-prod-cvs
S3_REGION=us-east-1
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=secret

# OpenAI (Phase 2)
OPENAI_API_KEY=sk-...

# App
PORT=3000
NODE_ENV=production
```

---

## Cost Estimation (Monthly)

### MVP (Phase 1)

| Service | Tier | Cost |
|---------|------|------|
| **Vercel** | Pro (if needed) | $20/mo (or Free) |
| **Railway** | 3 services x $5 | $15/mo |
| **Neon** | Free tier | $0 (< 3GB) |
| **Upstash Kafka** | Free tier | $0 (< 10K msgs) |
| **Upstash Redis** | Free tier | $0 (< 10K cmds) |
| **AWS S3** | Pay-as-you-go | ~$5/mo (estimate) |
| **Total** | | **~$40/mo** |

### Scale (Phase 2 - 1000 users)

| Service | Tier | Cost |
|---------|------|------|
| **Vercel** | Pro | $20/mo |
| **Railway** | 3 services x $20 | $60/mo |
| **Neon** | Pro | $19/mo |
| **Upstash Kafka** | Pay-as-you-go | $10/mo |
| **Upstash Redis** | Pay-as-you-go | $10/mo |
| **AWS S3** | | $20/mo |
| **Total** | | **~$139/mo** |

---

## Migration Path (If Needed)

If we outgrow managed services:

### Phase 3: Self-Hosted
```
Railway → AWS EC2 / DigitalOcean Droplets
Upstash Kafka → Self-hosted Kafka (MSK or EC2)
Neon → AWS RDS PostgreSQL
```

### Phase 4: Kubernetes
```
EC2 → AWS EKS or GKE
Full Kubernetes deployment
```

---

## Consequences

### Positive:
- ✅ **Fast MVP**: Deploy in hours, not days
- ✅ **Low DevOps Overhead**: Managed services handle infrastructure
- ✅ **Cost-Effective**: ~$40/mo for MVP
- ✅ **Scalable**: Can handle 1000+ users without changes
- ✅ **Developer Experience**: Simple git push deployments

### Negative:
- ❌ **Vendor Lock-in**: Tied to Vercel, Railway, Upstash
- ❌ **Cost at Scale**: May get expensive beyond 10K users
- ❌ **Limited Control**: Cannot customize infrastructure deeply

### Mitigation:
- Use Docker for local dev (same environment)
- Design for portability (can migrate to AWS later)
- Monitor costs closely, optimize as we scale

---

## CI/CD Pipeline

### GitHub Actions

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test
      - run: npm run lint

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway
        run: echo "Railway auto-deploys from GitHub"
```

---

## Monitoring

### Required Monitoring:

1. **Vercel**:
   - Analytics (built-in)
   - Web Vitals
   - Error tracking

2. **Railway**:
   - Logs (built-in)
   - Metrics (CPU, Memory)
   - Uptime monitoring

3. **Neon**:
   - Database metrics
   - Query performance

### Additional Tools (Optional):
- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **Better Stack** (formerly Logtail) - Log aggregation

---

## Rollback Strategy

### Frontend (Vercel):
```bash
# Revert to previous deployment via Vercel dashboard
# Or redeploy specific commit
vercel --prod --force
```

### Backend (Railway):
```bash
# Railway keeps deployment history
# Rollback via Railway dashboard (1-click)
```

### Database (Neon):
```bash
# Point-in-time recovery available
# Restore from automatic backups
```

---

## Related Decisions

- [ADR-001: Use NestJS Monorepo](./ADR-001-nestjs-monorepo.md)
- [ADR-002: Use Apache Kafka](./ADR-002-kafka-message-queue.md)

---

## References

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app/)
- [Neon PostgreSQL](https://neon.tech/docs)
- [Upstash Kafka](https://docs.upstash.com/kafka)

---

**Last Updated:** 2026-02-01
