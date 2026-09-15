# Feature Specification: Workspace Multi-Tenancy

**Feature Branch**: `016-workspace-multi-tenancy`  
**Created**: 2026-06-07  
**Status**: Draft  
**Input**: User description: "Đọc đặc tả của tôi đã soạn sẵn trong @docs/workspace-saas-analysis.md và viết spec build saas b2b dựa trên mô tả"

## Problem Statement

The current implementation of the Workspace module in TalentFlow is User-centric rather than Workspace-centric (Tenant-centric). Core entities such as Jobs, Candidates, Applications, and Interviews do not contain a `workspaceId` and are isolated based on individual `createdById`. This prevents team collaboration as members of the same workspace cannot share, view, or manage each other's data. 

To transform TalentFlow into an enterprise-grade B2B SaaS ATS, we must refactor the architecture to support multi-tenancy where the Workspace serves as the primary data isolation and security boundary. This work primarily impacts `api-gateway/` (Prisma schema, context resolution, request filtering, and access control), but requires schema updates and coordinated flow adjustments.

## Scope And Ownership

- **Primary service(s)**: API Gateway (`api-gateway/`)
- **Runtime boundary**: HTTP API, RabbitMQ Publisher
- **Data boundary**: Prisma Schema (`api-gateway/prisma/schema.prisma`)
- **Active docs**: Use `.specify/` and `specs/` as the current planning surface; frozen sources are reference only.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Workspace-Centric Collaboration (Priority: P1)

As a Recruiter in a Business Workspace, I want to view, edit, and collaborate on Jobs and Candidates created by other members of my Workspace, so that our hiring team can coordinate recruitment pipelines efficiently.

**Why this priority**: Collaboration is the foundational requirement of B2B SaaS. Currently, recruiters are siloed and cannot work together on shared job pipelines.  
**Independent Test**: Send a GET `/jobs` request with the `x-workspace-id` header of a shared workspace; verify it returns jobs created by all active workspace members.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** Recruiter A and Recruiter B are active members in Workspace W, **When** Recruiter A creates a Job in Workspace W, **Then** Recruiter B can see this Job when fetching jobs for Workspace W.
2. **Given** Recruiter A is a member of Workspace W and not Workspace V, **When** Recruiter A requests jobs, **Then** the response contains only jobs belonging to Workspace W and zero jobs from Workspace V.

### User Story 2 - Workspace Context Resolution and Switching (Priority: P2)

As a user with multiple workspaces, I want to switch between my Personal Workspace and Business Workspaces, so that I can manage hiring processes for different organizations or personal tasks without logging out.

**Why this priority**: Multi-tenant users require a clean way to change context. The backend must resolve the active workspace using the custom header or fall back gracefully to user settings or memberships.  
**Independent Test**: Call `PATCH /users/active-workspace` with a target workspace ID, then perform subsequent GET requests without the `x-workspace-id` header and verify they return data from the newly selected active workspace.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** A user with active memberships in Workspace W and Workspace V, **When** the user sends a `PATCH /users/active-workspace` with `workspaceId: V`, **Then** the user's `activeWorkspaceId` is updated in the database and a 200 OK is returned.
2. **Given** A user with active memberships in Workspace W, **When** the user attempts to switch active workspace to Workspace X (where they are not a member), **Then** the system throws a 403 Forbidden exception.
3. **Given** A request is sent without the `x-workspace-id` header, **When** the guard resolves the workspace context, **Then** it falls back to the user's `activeWorkspaceId` from the database.

### User Story 3 - Secure Token-Based Invitation Flow (Priority: P3)

As a Workspace Owner or Admin, I want to invite new members via email and have them accept the invitation through a secure token-based flow, so that we can verify their identity and consent before adding them to our workspace.

**Why this priority**: Security and regulatory compliance require explicit user consent via verification links, preventing unauthorized users from being immediately joined to workspace scopes.  
**Independent Test**: Call `POST /workspaces/:id/invitations` to generate an invitation token and check that the membership is created in `INVITED` status, then call `POST /workspaces/invitations/accept` with the token to verify it transitions to `ACTIVE`.  
**Service Ownership**: API Gateway (orchestrator/data owner) & Notification (email delivery)

**Acceptance Scenarios**:

1. **Given** An Admin of Workspace W invites a new user `newuser@example.com`, **When** the invitation is submitted, **Then** a `WorkspaceMember` record is created with `status: INVITED`, a `WorkspaceInvitation` token is generated, and a message is published to RabbitMQ to dispatch the email.
2. **Given** An invited user receives an email with an invitation link containing a token, **When** the user accepts the invitation, **Then** the `WorkspaceMember` status becomes `ACTIVE` and their `activeWorkspaceId` is set to the workspace they just joined.
3. **Given** A user attempts to invite a member to a Personal Workspace (`isBusiness = false`), **When** the invitation request is submitted, **Then** the system throws a 403 Forbidden exception.

## Edge Cases

- **Missing Workspace Header and Active Workspace**: If a request is received without `x-workspace-id` and the user has `activeWorkspaceId: null` in the database, the system must fall back to the first active workspace membership. If no active membership is found, it must throw a 400 Bad Request.
- **Concurrent Registration (Race Condition)**: When a new user registers, the database transaction creating the User, default Workspace, WorkspaceMember, and updating `activeWorkspaceId` must be atomic. If any step fails, the entire transaction must roll back to avoid orphaned or workspace-less users.
- **Expired/Invalid Invitation Tokens**: When a user attempts to accept an invitation using a token that is expired, already used, or invalid, the system must reject the request with a 400 Bad Request error and not change the membership status.
- **Role Permissions (RBAC Enforcement)**: A user with `role: VIEWER` attempting to create, update, or delete workspace resources (like Jobs) must be blocked immediately by a Workspace-scoped guard with a 403 Forbidden error.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST enforce workspace-centric data isolation by requiring a valid `workspaceId` on all database queries for core recruitment resources (`Job`, `Candidate`, `Application`, `Interview`, `EmailTemplate`).
- **FR-002**: The system MUST validate that the requesting user has an active membership (`status: ACTIVE`) in the target workspace context before allowing access to any resource in that workspace.
- **FR-003**: The system MUST dynamically resolve the workspace context for every HTTP request in the following order:
  1. The custom request header `x-workspace-id`.
  2. The authenticated user's `activeWorkspaceId` stored in the database.
  3. Fallback to the first active workspace membership found for the user.
- **FR-004**: The system MUST automatically provision a default Personal Workspace (with `isBusiness = false`, named `[User Name] - Personal Workspace`) and an active membership (`role: OWNER`, `status: ACTIVE`) for every new user during signup in a single atomic database transaction.
- **FR-005**: The system MUST restrict membership invitation capabilities, throwing a 403 Forbidden exception if an invite is sent for a workspace where `isBusiness` is `false`.
- **FR-006**: The system MUST implement a secure, token-based invitation flow, storing invitations in a `WorkspaceInvitation` entity with a secure token and expiration date, and initializing memberships in `status: INVITED`.
- **FR-007**: The system MUST enforce workspace-scoped RBAC, mapping workspace roles (`OWNER`, `ADMIN`, `RECRUITER`, `VIEWER`) to specific action allowances on workspace resources.

### Cross-Service Contracts

- **Producer**: API Gateway publishes `workspace.member.invited` event when an invite is created.
- **Consumer**: Notification service consumes the event and sends an email.
- **Payload shape**: 
  ```json
  {
    "email": "string",
    "workspaceName": "string",
    "token": "string",
    "inviteUrl": "string"
  }
  ```
- **Compatibility rule**: Backward-compatible. No breaking change to existing notification consumers, but additions are required.
- **Validation rule**: Validate email format and check that `token` is a valid string/UUID.

### Service Boundary Notes

- **API Gateway**: Modify `prisma/schema.prisma` to add relations and indices. Implement a custom NestJS guard (`WorkspaceGuard`) and interceptor to inject `workspaceId` into requests. Refactor services (`JobsService`, `CandidatesService`, etc.) to filter queries by `workspaceId`.
- **CV Parser**: None (CV Parser consumes from RabbitMQ and processes files; it must preserve `workspaceId` in payloads passed back to the gateway or database if applicable).
- **Notification**: Consume the RabbitMQ invitation event and send the structured template email.

### Data / Schema Changes

- **Entity**: `User`
  - Attributes: `activeWorkspaceId String?` (Relation to `Workspace`)
- **Entity**: `Workspace`
  - Attributes: `isBusiness Boolean @default(false)`
- **Entity**: `WorkspaceMember`
  - Attributes: `status WorkspaceMemberStatus` (enum: `ACTIVE`, `INVITED`, `REJECTED`, `EXPIRED`)
- **Entity**: `WorkspaceInvitation`
  - Attributes: `id String`, `email String`, `workspaceId String`, `token String`, `expiresAt DateTime`, `createdAt DateTime` (owned by API Gateway)
- **Entity**: `Job`, `Candidate`, `Application`, `Interview`, `EmailTemplate`
  - Attributes: `workspaceId String` (Required foreign key to `Workspace`, Cascade on delete, index on `workspaceId`)
- **Migration impact**: Database migration needed. Requires a custom SQL script to:
  1. Create a Personal Workspace for all existing users.
  2. Map and associate all existing jobs, candidates, applications, interviews, and templates to their creator's new Personal Workspace.

### Operational Requirements

- **Security**: The workspace context must be verified against the authenticated user's memberships on every request. Token payload in invitations must be signed or cryptographically secure.
- **Observability**: Include the resolved `workspaceId` in all logs generated during a request lifecycle (via middleware/interceptor context).
- **Failure behavior**: Failed signup transactions must rollback completely. Invalid or expired invitation tokens must return user-friendly error codes.
- **Config**: None.

### Validation Expectations

- **Gateway**: `npm run lint`, `npm run build`, `npm test`, `npm run test:e2e`

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of API endpoints managing Jobs, Candidates, Applications, and Interviews filter records at the database query layer using the resolved `workspaceId`.
- **SC-002**: 100% of newly registered users are provisioned with an active Personal Workspace and `activeWorkspaceId` set within the signup transaction.
- **SC-003**: 0% data leakage between different workspaces, verified by automated security integration tests performing unauthorized queries.
- **SC-004**: API Gateway test coverage for Workspace-scoped guards and membership/invitation endpoints remains above 90%.

## Assumptions

- Users can only belong to workspaces where they have an active or pending membership record.
- The `notification` service is operational and connected to RabbitMQ to deliver invitation emails.
- Existing database records can be safely migrated by assigning them to a default Personal Workspace created for their original author (`createdById`).
