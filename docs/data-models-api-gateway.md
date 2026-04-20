# API Gateway Data Models

**Status:** Implemented

## Source of truth

The API Gateway data model is defined in `api-gateway/prisma/schema.prisma` and backed by PostgreSQL.

## Model overview

| Model | Purpose |
|---|---|
| `User` | Authenticated users and recruiters/interviewers/admins |
| `Job` | Job postings |
| `Workspace` | Hiring workspace or business container |
| `WorkspaceMember` | Many-to-many membership between users and workspaces |
| `Candidate` | Candidate identity and resume profile |
| `Application` | A candidate applying to a job |
| `Interview` | Interview scheduling and outcome tracking |

## Entities

### User

| Field | Notes |
|---|---|
| `id` | UUID primary key |
| `email` | Unique |
| `password` | Stored hash |
| `role` | `ADMIN`, `RECRUITER`, or `INTERVIEWER` |
| `fullName` | Mapped to `full_name` |
| `createdJobs` | One-to-many to `Job` |
| `interviews` | One-to-many to `Interview` |
| `workspaceMembers` | Memberships for workspaces the user belongs to |
| `invitedWorkspaceMembers` | Memberships the user invited |
| `createdAt` / `updatedAt` | Timestamps |
| `deletedAt` | Soft delete marker |

### Job

| Field | Notes |
|---|---|
| `id` | UUID primary key |
| `title` | Required |
| `description` | Optional |
| `requirements` | JSON payload |
| `department` | Optional |
| `location` | Optional |
| `employmentType` | `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERNSHIP` |
| `salaryMin` / `salaryMax` | Optional integers |
| `status` | `DRAFT`, `OPEN`, `CLOSED`, `ARCHIVED` |
| `createdById` | FK to `User` |
| `applications` | One-to-many to `Application` |
| `createdAt` / `updatedAt` | Timestamps |
| `deletedAt` | Soft delete marker |

### Workspace

| Field | Notes |
|---|---|
| `id` | UUID primary key |
| `name` | Workspace name |
| `isBusiness` | Boolean business flag |
| `members` | One-to-many to `WorkspaceMember` |
| `createdAt` / `updatedAt` | Timestamps |

### WorkspaceMember

| Field | Notes |
|---|---|
| `id` | UUID primary key |
| `workspaceId` | FK to `Workspace` |
| `userId` | FK to `User` |
| `role` | `OWNER`, `ADMIN`, `RECRUITER`, `VIEWER` |
| `status` | `ACTIVE`, `INVITED`, `REMOVED` |
| `invitedById` | Optional FK to `User` |
| `createdAt` / `updatedAt` | Timestamps |

**Constraints**
- Unique composite key on `(workspaceId, userId)`
- Indexes on `(workspaceId, status)` and `(userId, status)`

### Candidate

| Field | Notes |
|---|---|
| `id` | UUID primary key |
| `email` | Unique |
| `fullName` | Mapped to `full_name` |
| `phone` | Optional |
| `linkedinUrl` | Optional |
| `resumeUrl` | Optional |
| `resumeText` | Optional text payload |
| `createdAt` / `updatedAt` | Timestamps |

### Application

| Field | Notes |
|---|---|
| `id` | UUID primary key |
| `jobId` | FK to `Job` |
| `candidateId` | FK to `Candidate` |
| `stage` | `APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED` |
| `status` | `SUBMITTED`, `REVIEWING`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `INTERVIEWED`, `OFFERED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN` |
| `cvFileKey` | Object storage key |
| `cvFileUrl` | Stored file URL |
| `coverLetter` | Optional text |
| `notes` | Optional recruiter notes |
| `appliedAt` | Submission timestamp |
| `reviewedAt` | Optional review timestamp |
| `createdAt` / `updatedAt` | Timestamps |
| `deletedAt` | Soft delete marker |

**Constraints**
- Unique composite key on `(jobId, candidateId)`
- Indexes on `jobId`, `candidateId`, and `status`

### Interview

| Field | Notes |
|---|---|
| `id` | UUID primary key |
| `applicationId` | FK to `Application` |
| `scheduledAt` | Scheduled time |
| `duration` | Minutes, default 60 |
| `type` | `PHONE`, `VIDEO`, `IN_PERSON`, `PANEL`, `TECHNICAL` |
| `location` | Optional link/address |
| `notes` | Optional notes |
| `status` | `SCHEDULED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `interviewerId` | Optional FK to `User` |
| `createdAt` / `updatedAt` | Timestamps |

## Relationship summary

- A `User` creates many `Job` records.
- A `Job` has many `Application` records.
- A `Candidate` can apply to many jobs through `Application`.
- An `Application` can have many `Interview` records.
- `Workspace` and `User` are connected through `WorkspaceMember`.
- `Interview` can optionally point to a `User` acting as interviewer.

## Data model notes

- Soft deletes are used on `User`, `Job`, and `Application`.
- `Candidate` records can be auto-created from authenticated user data during application flows.
- `Application` stores both object-storage references and a URL because the current runtime exposes both.
- The schema is intentionally ATS-focused rather than generic CRM modeling.

## Practical implications for feature work

- When adding a new resource, prefer extending the current Prisma model set rather than inventing a parallel domain table.
- Any change to application lifecycle should consider the unique `(jobId, candidateId)` constraint.
- Workspaces and membership status should be updated carefully because role checks depend on them.
- Keep status fields aligned with controllers and services; they are part of the business contract.
