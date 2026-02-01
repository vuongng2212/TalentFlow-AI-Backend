# ADR-005: Separate Repos for Frontend and Backend

**Status:** Accepted
**Date:** 2026-02-01
**Deciders:** Team (2 developers)

---

## Context

We need to decide on repository structure for TalentFlow AI codebase.

**Options considered:**
1. **Monorepo (Backend + Frontend together)** - Single repo with all code
2. **Separate Repos** - Backend repo + Frontend repo
3. **Polyrepo** - Multiple repos (Backend, Frontend, Shared libs)

---

## Decision

We will use **Separate Repositories**:
- **`talentflow-backend`** - NestJS monorepo (this repo)
- **`talentflow-frontend`** - Next.js 16 application

---

## Rationale

### Why Separate Repos?

✅ **Pros:**
1. **Clear Boundaries**: Backend and Frontend are independent
2. **Deployment Simplicity**:
   - Frontend → Vercel (auto-deploy from frontend repo)
   - Backend → Railway (auto-deploy from backend repo)
3. **Independent Versioning**: Each repo can have its own versioning
4. **Build Performance**: Smaller repos = faster CI/CD
5. **Access Control**: Can grant different permissions if needed
6. **Tooling**: Different tools for FE (Next.js) vs BE (NestJS)

❌ **Cons:**
1. **Code Sharing Harder**: Cannot share types directly
2. **Two PRs**: Changes affecting both need 2 PRs
3. **Coordination**: Need to sync changes between repos

### Why NOT Monorepo (Backend + Frontend)?

❌ **Drawbacks:**
1. **Deployment Complexity**:
   - Vercel and Railway would both need to build from same repo
   - Harder to configure build paths
2. **Large Repo**: Git operations slower
3. **Tooling Conflicts**: Next.js and NestJS configs in same repo
4. **Overkill for 2 people**: Monorepo tools (Nx, Turborepo) add complexity

✅ **When Monorepo Makes Sense:**
- Big companies (Google, Facebook)
- Need to share lots of code
- Multiple teams working on different parts
- **Not our situation**: 2-person team, simple deployment needs

---

## Handling Type Sharing

### Problem:
Backend has DTOs in TypeScript. Frontend needs same types.

### Solutions:

#### Option 1: OpenAPI/Swagger (Recommended)
```typescript
// Backend generates OpenAPI spec
// Frontend consumes it

// Install on frontend:
npm install openapi-typescript-codegen

// Generate types:
npx openapi-typescript-codegen \
  --input https://api.talentflow.ai/api-json \
  --output ./src/types/api
```

**Result**: Auto-generated TypeScript types from backend API

#### Option 2: NPM Package (For Phase 2)
```typescript
// Create shared package
// @talentflow/types

// Backend: Export types
export interface CreateJobDto {
  title: string;
  description: string;
}

// Frontend: Import types
import { CreateJobDto } from '@talentflow/types';
```

**Complexity**: Need to publish to NPM or use private registry

#### Option 3: Copy-Paste DTOs (MVP)
```typescript
// Manually copy DTOs from backend to frontend
// Good enough for MVP with few types
// Update manually when backend changes
```

---

## Repository Structure

### Backend Repo (`talentflow-backend`)

```
talentflow-backend/
├── apps/
│   ├── api-gateway/
│   ├── ai-worker/
│   └── notification-service/
├── libs/
│   ├── common/
│   ├── database/
│   ├── kafka/
│   └── domain/
├── docs/
├── docker-compose.yml
├── package.json
└── README.md
```

### Frontend Repo (`talentflow-frontend`)

```
talentflow-frontend/
├── src/
│   ├── app/              # Next.js 16 App Router
│   ├── components/
│   ├── lib/
│   └── types/            # Generated from OpenAPI
├── public/
├── package.json
└── README.md
```

---

## Workflow: Making Changes

### Scenario 1: Backend-Only Change
```bash
# Work in backend repo
cd talentflow-backend
git checkout -b feature/add-job-status
# Make changes
git commit -m "feat(jobs): add status filter"
git push
# Create PR → Merge
```

**Frontend**: No changes needed ✅

### Scenario 2: Frontend-Only Change
```bash
# Work in frontend repo
cd talentflow-frontend
git checkout -b feature/improve-dashboard
# Make changes
git commit -m "feat(ui): improve dashboard layout"
git push
# Create PR → Merge
```

**Backend**: No changes needed ✅

### Scenario 3: Full-Stack Change (API + UI)
```bash
# 1. Backend first
cd talentflow-backend
git checkout -b feature/add-interview-scheduling
# Add API endpoint
git commit -m "feat(interviews): add scheduling endpoint"
git push
# Deploy to staging

# 2. Frontend second
cd talentflow-frontend
git checkout -b feature/add-interview-scheduling
# Regenerate types from OpenAPI
npm run generate-api-types
# Implement UI
git commit -m "feat(interviews): add scheduling UI"
git push
```

**Coordination**: Use GitHub issues to link related PRs

---

## Version Synchronization

### Backend API Versioning
```
/api/v1/jobs      # Version 1
/api/v2/jobs      # Version 2 (breaking changes)
```

### Frontend Compatibility
```typescript
// Frontend config
const API_VERSION = 'v1';
const API_BASE_URL = `https://api.talentflow.ai/api/${API_VERSION}`;
```

**Strategy**: Frontend explicitly pins API version

---

## Consequences

### Positive:
- ✅ **Simple Deployment**: Each repo deploys independently
- ✅ **Fast CI/CD**: Smaller repos = faster builds
- ✅ **Clear Ownership**: Easy to understand what's where
- ✅ **Vercel + Railway Native**: Optimal for our deployment stack

### Negative:
- ❌ **Type Sharing**: Requires OpenAPI generation or manual sync
- ❌ **Coordination Overhead**: Need to coordinate cross-repo changes
- ❌ **Two Repos to Manage**: More repos to clone, update, etc.

### Mitigation:
- Use OpenAPI to auto-generate types (eliminates manual sync)
- Use GitHub Projects to track cross-repo work
- Document cross-repo workflows clearly
- Keep APIs stable (minimize breaking changes)

---

## Future Consideration

### When to Move to Monorepo?

Consider monorepo if:
1. Team grows to 5+ developers
2. Sharing code becomes a major pain point
3. Need to ensure atomic changes across FE+BE
4. Have resources to manage monorepo tooling (Nx/Turborepo)

### Migration Path:
```bash
# Combine repos using git subtree
git subtree add --prefix=backend backend-repo main
git subtree add --prefix=frontend frontend-repo main
```

---

## Related Decisions

- [ADR-001: Use NestJS Monorepo](./ADR-001-nestjs-monorepo.md)
- [ADR-004: Deployment Strategy](./ADR-004-deployment-strategy.md)

---

## References

- [Monorepo vs Polyrepo](https://earthly.dev/blog/monorepo-vs-polyrepo/)
- [OpenAPI TypeScript Codegen](https://github.com/ferdikoomen/openapi-typescript-codegen)

---

**Last Updated:** 2026-02-01
