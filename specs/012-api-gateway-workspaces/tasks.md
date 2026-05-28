# Tasks: API Gateway Workspaces

**Input**: Design documents from `/specs/012-api-gateway-workspaces/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/012-api-gateway-workspaces/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing workspaces behavior.

- [x] T001 Review the current runtime entrypoint and affected workspaces files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/workspaces/workspaces.module.ts`, and `api-gateway/src/workspaces/**`
- [x] T002 [P] Capture the workspaces HTTP contract in `specs/012-api-gateway-workspaces/spec.md` from `api-gateway/src/workspaces/workspaces.controller.ts`, `api-gateway/src/workspaces/dto/*.ts`, and `api-gateway/src/workspaces/workspaces.service.ts`
- [x] T003 [P] Record validation, entitlement, and role requirements in `api-gateway/src/workspaces/dto/*.ts` and the gateway auth guard stack

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/workspaces/workspaces.module.ts` with `WorkspacesController` and `WorkspacesService`
- [x] T005 [P] Define the request DTOs in `api-gateway/src/workspaces/dto/create-workspace.dto.ts` and `api-gateway/src/workspaces/dto/add-workspace-member.dto.ts`
- [x] T006 [P] Establish bounds for the workspace member cap in `api-gateway/src/workspaces/workspaces.service.ts` and `api-gateway/src/common/config`
- [x] T007 Keep the minimum Prisma transaction and lookup wiring in `api-gateway/src/workspaces/workspaces.service.ts` and `api-gateway/src/prisma/prisma.service.ts`

**Checkpoint**: The workspaces boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Create a Workspace (Priority: P1)

**Goal**: Return a newly created workspace and its owner membership to authorized internal roles.

**Independent Test**: `POST /workspaces` returns the created workspace and establishes the owner membership in one transaction.

### Tests for User Story 1

- [x] [P] [US1] Cover create-workspace controller behavior in `api-gateway/src/workspaces/workspaces.controller.ts` and `api-gateway/src/workspaces/workspaces.controller.spec.ts` if present
- [x] [P] [US1] Cover workspace creation and owner membership transaction behavior in `api-gateway/src/workspaces/workspaces.service.spec.ts`

### Implementation for User Story 1

- [x] [US1] Implement create-workspace handler in `api-gateway/src/workspaces/workspaces.controller.ts`
- [x] [US1] Implement workspace creation and owner membership in `api-gateway/src/workspaces/workspaces.service.ts`
- [x] [US1] Preserve request DTO validation in `api-gateway/src/workspaces/dto/create-workspace.dto.ts`

**Checkpoint**: Workspace creation should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Add a Workspace Member (Priority: P2)

**Goal**: Allow recruiter or admin callers who are workspace owners or admins to invite members into a business-enabled workspace.

**Independent Test**: `POST /workspaces/:id/members` returns the new or reactivated member when all constraints pass.

### Tests for User Story 2

- [x] [P] [US2] Cover member-invite controller behavior in `api-gateway/src/workspaces/workspaces.controller.ts` and `api-gateway/src/workspaces/workspaces.controller.spec.ts` if present
- [x] [P] [US2] Cover business entitlement, access checks, cap checks, and reactivation behavior in `api-gateway/src/workspaces/workspaces.service.spec.ts`

### Implementation for User Story 2

- [x] [US2] Implement member-invite handler in `api-gateway/src/workspaces/workspaces.controller.ts`
- [x] [US2] Implement workspace-member invite and reactivation logic in `api-gateway/src/workspaces/workspaces.service.ts`
- [x] [US2] Preserve member-invite validation in `api-gateway/src/workspaces/dto/add-workspace-member.dto.ts`

**Checkpoint**: Workspace membership management should now be independently testable.

---

## Phase 5: User Story 3 - List Active Members (Priority: P3)

**Goal**: Return the active members of a workspace to recruiter or admin callers who are active workspace members.

**Independent Test**: `GET /workspaces/:id/members` returns active members ordered by creation time for recruiter or admin callers who are active workspace members.

### Tests for User Story 3

- [x] [P] [US3] Cover list-members controller behavior in `api-gateway/src/workspaces/workspaces.controller.ts` and `api-gateway/src/workspaces/workspaces.controller.spec.ts` if present
- [x] [P] [US3] Cover member listing and access checks in `api-gateway/src/workspaces/workspaces.service.spec.ts`

### Implementation for User Story 3

- [x] [US3] Implement list-members handler in `api-gateway/src/workspaces/workspaces.controller.ts`
- [x] [US3] Implement active-member listing in `api-gateway/src/workspaces/workspaces.service.ts`
- [x] [US3] Preserve member-list response ordering and user projection in `api-gateway/src/workspaces/workspaces.service.ts`

**Checkpoint**: Active member listing should now be independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T024 [P] Update the migrated documentation in `specs/012-api-gateway-workspaces/spec.md`, `specs/012-api-gateway-workspaces/plan.md`, and `specs/012-api-gateway-workspaces/tasks.md`
- [x] T025 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T026 [P] Preserve observability and failure-path behavior in `api-gateway/src/workspaces/workspaces.service.ts`
- [x] T027 Validate backward compatibility for the existing route names, DTO field names, and response shape in `api-gateway/src/workspaces/**`

## Gaps Found

- The available automated coverage is centered on `WorkspacesService`; there is no dedicated controller spec or HTTP e2e coverage for the workspaces routes.
- The spec records `workspace.isBusiness` as the current entitlement proxy because billing/subscription ownership is not present in the runtime slice.
- No Prisma schema or migration work was required for this slice because workspaces are derived from existing Prisma data rather than new tables.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- workspaces`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer controller and service tests for membership workflows.
- Preserve the role restriction so the workspace surface stays non-mutating for unauthorized callers.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.
