# ADR-003: Use Prisma as ORM Instead of TypeORM

**Status:** Accepted
**Date:** 2026-02-01
**Deciders:** Team (2 developers)

---

## Context

We need an ORM (Object-Relational Mapping) tool to interact with PostgreSQL database.

**Options considered:**
1. **Prisma** - Modern TypeScript-first ORM
2. **TypeORM** - Popular NestJS ORM
3. **Sequelize** - Traditional Node.js ORM
4. **Raw SQL with pg library** - No ORM

---

## Decision

We will use **Prisma** as our ORM.

---

## Rationale

### Why Prisma?

✅ **Pros:**
1. **Type Safety**: Auto-generated TypeScript types from schema
2. **Developer Experience**: Excellent autocomplete and IntelliSense
3. **Schema-First**: Define schema in `schema.prisma`, not decorators
4. **Migrations**: Built-in migration system (`prisma migrate`)
5. **Prisma Studio**: Visual database browser (great for debugging)
6. **Query Performance**: Optimized queries, N+1 prevention
7. **Modern**: Active development, growing ecosystem
8. **Documentation**: Excellent docs and examples

❌ **Cons:**
1. **Less NestJS Integration**: Requires manual setup (not first-class like TypeORM)
2. **Learning Curve**: Different paradigm from traditional ORMs
3. **Raw SQL Limitations**: Complex queries may need raw SQL

### Why NOT TypeORM?

- **Decorator-heavy**: Entities defined with decorators (verbose)
- **Type Safety**: Less strict than Prisma
- **Migration Issues**: Migration system has known bugs
- **Active Development**: Less active maintenance compared to Prisma

### Why NOT Sequelize?

- **JavaScript-first**: Not designed for TypeScript
- **Older Paradigm**: Traditional ORM patterns
- **Type Safety**: Weak TypeScript support

### Why NOT Raw SQL?

- **Boilerplate**: Too much manual code
- **No Type Safety**: No compile-time checks
- **Migration Management**: Need to build custom solution

---

## Implementation

### Prisma Schema Example:

```prisma
// libs/database/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  role      Role     @default(RECRUITER)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  jobs      Job[]

  @@map("users")
}

model Job {
  id          String    @id @default(uuid())
  title       String
  description String    @db.Text
  status      JobStatus @default(DRAFT)
  createdById String    @map("created_by_id")
  createdAt   DateTime  @default(now()) @map("created_at")

  createdBy   User        @relation(fields: [createdById], references: [id])
  applications Application[]

  @@map("jobs")
}

enum Role {
  ADMIN
  RECRUITER
  INTERVIEWER
}

enum JobStatus {
  DRAFT
  OPEN
  CLOSED
}
```

### Usage in Service:

```typescript
// Example: JobService
@Injectable()
export class JobService {
  constructor(private prisma: PrismaService) {}

  async createJob(data: CreateJobDto, userId: string): Promise<Job> {
    return this.prisma.job.create({
      data: {
        ...data,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  async getJobById(id: string): Promise<Job | null> {
    return this.prisma.job.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            candidate: true,
          },
        },
      },
    });
  }
}
```

### Benefits in Practice:

1. **Autocomplete Everywhere**:
   ```typescript
   // ✅ TypeScript knows all fields
   const job = await prisma.job.findUnique({
     where: { id },
     select: {
       title: true,
       // Autocomplete shows: description, status, etc.
     },
   });
   ```

2. **Compile-Time Errors**:
   ```typescript
   // ❌ TypeScript error: "titlee" doesn't exist
   const job = await prisma.job.create({
     data: { titlee: 'Developer' }
   });
   ```

3. **Type-Safe Relations**:
   ```typescript
   // ✅ Knows that job.createdBy exists
   const job = await prisma.job.findUnique({
     where: { id },
     include: { createdBy: true },
   });

   console.log(job.createdBy.email); // ✅ Type-safe
   ```

---

## Migration Strategy

### Development Workflow:

```bash
# 1. Edit schema.prisma
# Add new field to User model
model User {
  ...
  phoneNumber String? @map("phone_number")
}

# 2. Create migration
npx prisma migrate dev --name add_phone_to_user

# 3. Generated files:
# - Migration SQL in prisma/migrations/
# - Updated Prisma Client types
```

### Production Deployment:

```bash
# Run migrations in production
npx prisma migrate deploy
```

### Seed Data:

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  await prisma.user.upsert({
    where: { email: 'admin@talentflow.ai' },
    update: {},
    create: {
      email: 'admin@talentflow.ai',
      password: 'hashed_password',
      role: 'ADMIN',
    },
  });

  console.log('✅ Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Consequences

### Positive:
- ✅ **Excellent DX**: Best-in-class developer experience
- ✅ **Type Safety**: Catch errors at compile time
- ✅ **Productivity**: Less boilerplate, faster development
- ✅ **Debugging**: Prisma Studio makes DB inspection easy

### Negative:
- ❌ **NestJS Integration**: Manual setup required (no `@nestjs/prisma` official package)
- ❌ **Complex Queries**: May need raw SQL for very complex queries
- ❌ **Learning Curve**: Different from traditional ORMs

### Mitigation:
- Create `PrismaService` wrapper for NestJS integration
- Use `prisma.$queryRaw` for complex queries when needed
- Document common Prisma patterns for team

---

## NestJS Integration

### PrismaService:

```typescript
// libs/database/src/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### PrismaModule:

```typescript
// libs/database/src/prisma.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## Testing

### Unit Tests with Mock:

```typescript
const mockPrismaService = {
  job: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

const module: TestingModule = await Test.createTestingModule({
  providers: [
    JobService,
    {
      provide: PrismaService,
      useValue: mockPrismaService,
    },
  ],
}).compile();
```

### E2E Tests with Test Database:

```typescript
// Use separate test database
// DATABASE_URL="postgresql://postgres:password@localhost:5432/talentflow_test"
```

---

## Performance Considerations

### N+1 Query Prevention:

```typescript
// ❌ Bad: N+1 queries
const jobs = await prisma.job.findMany();
for (const job of jobs) {
  const user = await prisma.user.findUnique({
    where: { id: job.createdById }
  });
}

// ✅ Good: Single query with include
const jobs = await prisma.job.findMany({
  include: {
    createdBy: true,
  },
});
```

### Pagination:

```typescript
const jobs = await prisma.job.findMany({
  take: 20,
  skip: (page - 1) * 20,
  orderBy: { createdAt: 'desc' },
});
```

---

## Related Decisions

- [ADR-001: Use NestJS Monorepo](./ADR-001-nestjs-monorepo.md)
- [ADR-005: Database Schema Design](./ADR-005-database-schema.md)

---

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma with NestJS](https://docs.nestjs.com/recipes/prisma)
- [Why Prisma?](https://www.prisma.io/docs/concepts/overview/why-prisma)

---

**Last Updated:** 2026-02-01
