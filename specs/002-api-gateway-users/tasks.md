# Tasks: API Gateway Users

**Input**: Design documents from `/specs/002-api-gateway-users/`
**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by service boundary and then by user story so each slice can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on another task
- **[Story]**: Which user story the task belongs to, such as US1, US2, or US3
- Always include exact file paths in the description

## Path Conventions

- API Gateway: `api-gateway/src/`, `api-gateway/prisma/`, `api-gateway/test/`
- Shared planning docs: `specs/002-api-gateway-users/`

## Phase 1: Setup And Contract Lock

**Purpose**: Confirm runtime ownership, lock the contract surface, and record the existing HTTP users behavior.

- [x] T001 Review the current runtime entrypoint and affected users files for the feature in `api-gateway/src/app.module.ts`, `api-gateway/src/users/users.module.ts`, and `api-gateway/src/users/**`
- [x] T002 [P] Capture the users HTTP contract in `specs/002-api-gateway-users/spec.md` from `api-gateway/src/users/users.controller.ts` and `api-gateway/src/users/dto/*.ts`
- [x] T003 [P] Record validation and guard requirements in `api-gateway/src/users/dto/query-users.dto.ts`, `api-gateway/src/users/dto/update-user.dto.ts`, `api-gateway/src/users/dto/update-role.dto.ts`, and the gateway auth guard stack

---

## Phase 2: Foundational Work

**Purpose**: Build the shared prerequisites that block all user stories for this feature.

- [x] T004 Wire `api-gateway/src/users/users.module.ts` with `UsersController` and `UsersService`
- [x] T005 [P] Define the request and response DTOs in `api-gateway/src/users/dto/query-users.dto.ts`, `api-gateway/src/users/dto/update-user.dto.ts`, `api-gateway/src/users/dto/update-role.dto.ts`, and `api-gateway/src/users/dto/user-response.dto.ts`
- [x] T006 [P] Establish pagination, role, and update validation rules in the users DTOs
- [x] T007 Keep the minimum persistence wiring in `api-gateway/src/users/users.service.ts` and `api-gateway/src/prisma/prisma.service.ts`

**Checkpoint**: The users boundary is wired and user story work can be validated independently.

---

## Phase 3: User Story 1 - Browse Users And Read Profiles (Priority: P1)

**Goal**: List active users for admins and read a single active user profile.

**Independent Test**: `GET /users` and `GET /users/:id` return the expected list/profile data and exclude soft-deleted users.

### Tests for User Story 1

- [x] T008 [P] [US1] Cover list and profile controller behavior in `api-gateway/src/users/users.controller.spec.ts`
- [x] T009 [P] [US1] Cover pagination, search/filtering, profile lookup, and soft-delete filtering in `api-gateway/src/users/users.service.spec.ts`

### Implementation for User Story 1

- [x] T010 [US1] Implement list and profile handlers in `api-gateway/src/users/users.controller.ts`
- [x] T011 [US1] Implement paginated user queries, search/filtering, and active-profile lookup in `api-gateway/src/users/users.service.ts`
- [x] T012 [US1] Preserve validated query and response DTO shapes in `api-gateway/src/users/dto/query-users.dto.ts` and `api-gateway/src/users/dto/user-response.dto.ts`

**Checkpoint**: List and profile reads should now be fully functional and independently testable.

---

## Phase 4: User Story 2 - Update Profile Data (Priority: P2)

**Goal**: Update a user profile name and allow admins to update user roles.

**Independent Test**: `PATCH /users/:id` and `PATCH /users/:id/role` persist the expected user changes and reject unauthorized cross-user updates.

### Tests for User Story 2

- [x] T013 [P] [US2] Cover profile-update controller behavior in `api-gateway/src/users/users.controller.spec.ts`
- [x] T014 [P] [US2] Cover self-or-admin ownership checks and role updates in `api-gateway/src/users/users.service.spec.ts`

### Implementation for User Story 2

- [x] T015 [US2] Implement profile-update and role-change handlers in `api-gateway/src/users/users.controller.ts`
- [x] T016 [US2] Implement self-or-admin profile updates and role persistence in `api-gateway/src/users/users.service.ts`
- [x] T017 [US2] Preserve update DTO validation in `api-gateway/src/users/dto/update-user.dto.ts` and `api-gateway/src/users/dto/update-role.dto.ts`

**Checkpoint**: Profile updates should now be independently testable.

---

## Phase 5: User Story 3 - Administer Accounts (Priority: P3)

**Goal**: Change user roles and soft-delete accounts from the admin boundary.

**Independent Test**: `PATCH /users/:id/role` and `DELETE /users/:id` persist the expected administrative changes and enforce admin-only access.

### Tests for User Story 3

- [x] T018 [P] [US3] Cover role-change and soft-delete controller behavior in `api-gateway/src/users/users.controller.spec.ts`
- [x] T019 [P] [US3] Cover admin-only role changes and soft-delete behavior in `api-gateway/src/users/users.service.spec.ts`

### Implementation for User Story 3

- [x] T020 [US3] Implement admin role-change and soft-delete handlers in `api-gateway/src/users/users.controller.ts`
- [x] T021 [US3] Implement admin role updates and soft-delete persistence in `api-gateway/src/users/users.service.ts`
- [x] T022 [US3] Preserve the gateway auth and role guard wiring in `api-gateway/src/auth/guards/jwt-auth.guard.ts`, `api-gateway/src/auth/guards/roles.guard.ts`, and `api-gateway/src/app.module.ts`

**Checkpoint**: Administrative user operations should now be active and independently testable.

---

## Phase 6: Cross-Cutting Validation

**Purpose**: Work that touches multiple stories or service boundaries.

- [x] T023 [P] Update the migrated documentation in `specs/002-api-gateway-users/spec.md`, `specs/002-api-gateway-users/plan.md`, and `specs/002-api-gateway-users/tasks.md`
- [x] T024 [P] Run or update the owning service tests using the real gateway commands in `api-gateway/package.json`
- [x] T025 [P] Preserve observability and failure-path behavior in `api-gateway/src/users/users.service.ts`
- [x] T026 Validate backward compatibility for the existing route names, DTO field names, pagination limits, and response envelope shapes in `api-gateway/src/users/dto/*.ts` and `api-gateway/src/users/users.controller.ts`

## Gaps Found

- There is no dedicated HTTP e2e test that drives the full users flow through the Nest runtime; current coverage is primarily unit-level around controller and service behavior.
- The controller relies on the global auth guard stack for authentication and RBAC rather than local guard declarations on every route.
- No Prisma schema or migration work was required for this slice because the feature uses the existing user model.

## Dependencies & Execution Order

### Phase Dependencies

- Setup and contract lock can start immediately.
- Foundational work blocks all user stories.
- User stories can proceed in priority order once the foundation is ready.
- Cross-cutting validation comes after the story slices that it depends on.

### Service-Specific Validation Commands

- API Gateway: `cd api-gateway && npm test -- users`, `cd api-gateway && npm run build`, `cd api-gateway && npm test`

### Implementation Notes

- Keep tests close to the touched boundary.
- Prefer controller and service tests for CRUD and RBAC behavior.
- Prefer Prisma-backed checks for pagination, filtering, and soft-delete semantics.
- Avoid cross-story coupling unless the contract truly requires it.

## Notes

- [P] tasks can run in parallel because they touch different files with no dependency.
- Each user story is independently completable and testable.
- This feature is already present in runtime code; the tasks document records what exists rather than a work queue to execute.