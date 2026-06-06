# Feature Specification: Subscription Plans

**Feature Branch**: `015-subscription-plans`  
**Created**: 2026-06-06  
**Status**: Draft  
**Input**: User description: "Design Free, Plus, and Business subscriptions for TalentFlow AI. Free is default on account creation with limited CV AI scoring. Plus is for individual users with higher daily limits and CV fit analysis. Business activates workspace entitlement, workspace member invitation, role assignment, and a shared workspace AI request pool. If a Plus user also joins a workspace, personal space uses Plus while workspace space uses Business."

## Problem Statement

TalentFlow AI needs a clear subscription model that separates personal entitlement from workspace entitlement. Today workspace membership uses a temporary business flag, but the product needs explicit Free, Plus, and Business plans so users understand which AI scoring and CV analysis capabilities they can use, how daily limits are consumed, and which context applies when a user has both a personal Plus plan and workspace Business access.

This feature belongs primarily in the API Gateway because subscription state, entitlement decisions, workspace activation, member permission checks, and AI request gating are user-facing HTTP and persistence concerns. AI scoring or analysis workers remain consumers of an entitlement decision rather than owners of subscription policy.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP API and entitlement checks before AI scoring or CV analysis requests
- **Data boundary**: Subscription plans, user subscriptions, workspace subscriptions or entitlements, workspace membership, and AI usage counters
- **Active docs**: Use `.specify/` and `specs/` as the current planning surface; frozen sources are reference only.

## User Scenarios & Testing _(mandatory)_

User stories are ordered by business priority and independently testable. Each story names the service boundary it touches.

### User Story 1 - Default Free Plan For New Accounts (Priority: P1)

When a new user account is created, the user automatically receives the Free plan so they can try AI CV scoring without any subscription setup.

**Why this priority**: Free is the default acquisition path and must work before upgrades or workspace activation matter.  
**Independent Test**: Create a new account, inspect the user's active personal entitlement, and submit AI CV scoring requests until the total trial and daily limits are reached.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a user has just created an account, **When** the account is active, **Then** the user owns the Free plan by default.
2. **Given** a Free user has remaining trial and daily quota, **When** the user requests AI CV scoring in personal space, **Then** the request is allowed and returns a score on a 100-point scale.
3. **Given** a Free user has used 15 total trial AI scoring requests, **When** the user requests another Free AI scoring action, **Then** the system blocks the request until the user upgrades.
4. **Given** a Free user has used 5 AI scoring requests in the current day, **When** the user requests another AI scoring action that day, **Then** the system blocks the request until the daily quota resets or the user upgrades.
5. **Given** a Free user requests Plus-only CV summary or fit analysis, **When** the request is evaluated, **Then** the system denies access and explains that the capability requires Plus or an eligible workspace context.

### User Story 2 - Plus Plan For Individual Users (Priority: P2)

An individual user can move from Free to Plus for one month at a time, gaining higher personal AI request limits and CV fit analysis that summarizes strengths and weaknesses against recruiter criteria.  
**Why this priority**: Plus is the personal paid plan and must clearly improve the individual experience without changing workspace permissions.  
**Independent Test**: Activate Plus for a user, submit personal AI requests up to the Plus daily limit, and verify the CV summary and strengths/weaknesses analysis is available in personal space.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a Free user activates Plus, **When** the subscription becomes active, **Then** personal-space AI quota changes to 20 requests per day.
2. **Given** a Plus user has remaining daily quota, **When** the user requests AI CV scoring in personal space, **Then** the request is allowed and returns a score on a 100-point scale.
3. **Given** a Plus user has used 20 personal AI requests in the current day, **When** the user requests another personal AI action, **Then** the system blocks the request until the daily quota resets.
4. **Given** a Plus user has recruiter criteria available for a CV review, **When** the user requests CV fit analysis, **Then** the system returns a summary of strengths and weaknesses against those criteria.
5. **Given** a Plus subscription expires or is cancelled at the end of the month, **When** the user continues in personal space, **Then** the user falls back to Free entitlement while preserving usage history.

### User Story 3 - Business Plan Activates Workspace (Priority: P3)

A user can activate Business for one month at a time to unlock workspace collaboration, invite existing account holders, assign workspace roles, and use a shared workspace AI request pool.  
**Why this priority**: Business replaces the current temporary business flag with a real workspace entitlement and enables team collaboration.  
**Independent Test**: Activate Business for a workspace, verify the purchaser receives admin capability, invite an existing user, assign a workspace role, and consume the shared workspace AI quota until the daily limit is reached.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a user activates Business for a workspace, **When** the subscription becomes active, **Then** the workspace is considered Business-enabled for member management and workspace AI usage.
2. **Given** a Business workspace is active, **When** the purchaser manages the workspace, **Then** the purchaser has Admin permission for the workspace.
3. **Given** a Business workspace admin invites a person who already has an account, **When** the invitation is accepted or applied, **Then** the invited user becomes a workspace member.
4. **Given** a Business workspace admin assigns a member role, **When** the assignment is saved, **Then** the member's workspace permissions reflect that role.
5. **Given** a Business workspace has used fewer than 500 AI requests in the current day, **When** any eligible workspace member requests AI scoring or analysis inside that workspace, **Then** the request consumes from the workspace's shared daily pool.
6. **Given** a Business workspace has used 500 AI requests in the current day, **When** a workspace member requests another workspace AI action, **Then** the system blocks the request until the workspace daily quota resets.

### User Story 4 - Resolve Plus And Workspace Context (Priority: P4)

A user who owns Plus and also belongs to a Business workspace gets the correct entitlement based on where the action happens. Personal actions use the user's Plus plan; workspace actions use the workspace Business plan.  
**Why this priority**: This prevents quota confusion and keeps paid personal features separate from team entitlements.  
**Independent Test**: Give a user both active Plus and Business workspace membership, then perform the same AI action once in personal space and once in workspace space while verifying the correct quota pool and feature permissions are applied.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a Plus user is working in personal space, **When** the user requests AI scoring or CV fit analysis, **Then** the system applies Plus personal quota and Plus personal feature permissions.
2. **Given** the same Plus user is working inside a Business workspace, **When** the user requests AI scoring or CV fit analysis, **Then** the system applies the Business workspace quota and workspace feature permissions.
3. **Given** a Plus user has exhausted personal daily quota but belongs to a Business workspace with remaining quota, **When** the user requests an AI action inside the workspace, **Then** the workspace request is allowed if the member has permission.
4. **Given** a Business workspace has exhausted daily quota but a member has remaining Plus personal quota, **When** the member requests an AI action inside that workspace, **Then** the workspace request remains blocked and does not consume personal quota.

## Edge Cases

- A user signs up more than once with different accounts: Free trial quota is account-scoped; abuse prevention beyond normal account controls is out of scope for this spec.
- A user upgrades from Free to Plus after consuming some Free trial requests: Plus immediately applies its daily limit for personal space, while historical Free trial usage remains recorded.
- A Plus user downgrades or expires: the user reverts to Free at the end of the paid month unless another active personal subscription exists.
- A Business subscription expires: workspace Business entitlement is removed, member management that requires Business is disabled, and workspace AI requests stop using Business quota.
- A Business admin invites an email without an account: the invite is rejected or held as unavailable until an account exists; this feature requires invitees to already have accounts.
- A user belongs to multiple Business workspaces: each workspace has its own 500-request daily pool, and the active workspace context determines which pool is used.
- A request does not specify whether it is personal or workspace context: the system must reject the request or require an explicit context before consuming quota.
- A workspace member is removed: the member can no longer consume that workspace's Business quota, but their personal plan remains unchanged.
- Role definitions expand later: plan rules must continue to distinguish plan entitlement from workspace role permission.
- Daily quota reset boundaries must be consistent for all users and workspaces and must be visible enough for users to understand when access resumes.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST define exactly three active subscription plans for this release: Free, Plus, and Business.
- **FR-002**: The system MUST assign Free as the default personal plan whenever a new account is created.
- **FR-003**: The system MUST allow Free users to request AI CV scoring on a 100-point scale until both Free limits are respected: 15 total first-account trial requests and 5 requests per day.
- **FR-004**: The system MUST allow Plus users to request up to 20 personal AI actions per day.
- **FR-005**: The system MUST allow Plus users to access CV fit analysis that summarizes strengths and weaknesses against recruiter criteria.
- **FR-006**: The system MUST treat Plus as a personal user subscription and MUST NOT use Plus to unlock workspace member invitation or workspace administration.
- **FR-007**: The system MUST allow Business to activate workspace entitlement for one workspace for the active subscription month.
- **FR-008**: The system MUST grant the Business purchaser Admin permission for the activated workspace.
- **FR-009**: The system MUST allow Business workspace admins to invite only users who already have accounts.
- **FR-010**: The system MUST allow Business workspace admins to assign workspace roles to members while keeping plan entitlement separate from role permission.
- **FR-011**: The system MUST provide each active Business workspace with a shared daily AI request pool of 500 requests.
- **FR-012**: The system MUST consume personal quota for actions in personal space and workspace quota for actions in workspace space.
- **FR-013**: The system MUST apply Plus entitlement in personal space even when the user also belongs to a Business workspace.
- **FR-014**: The system MUST apply Business entitlement in workspace space even when the acting member also owns Plus.
- **FR-015**: The system MUST prevent personal quota from being used as overflow for exhausted workspace quota, and prevent workspace quota from being used as overflow for exhausted personal quota.
- **FR-016**: The system MUST expose enough subscription and quota status for users and workspace admins to understand current plan, remaining daily quota, and blocked actions.
- **FR-017**: The system MUST record AI usage with plan context, actor, target context, request type, and usage date so quota decisions can be audited.
- **FR-018**: The system MUST validate requested subscription transitions, workspace activation, member invitations, role assignments, and AI entitlement checks before changing state or consuming quota.
- **FR-019**: The system MUST preserve current workspace behavior by replacing the temporary business flag with Business entitlement only when the implementation phase migrates that runtime path.
- **FR-020**: The system MUST keep subscription duration to one-month periods for Plus and Business in this release.

### Cross-Service Contracts

- **Producer**: API Gateway entitlement decision for AI scoring and CV analysis requests
- **Consumer**: AI scoring and CV analysis execution path
- **Payload shape**: actor user, context type (`personal` or `workspace`), workspace identifier when applicable, requested AI action, resolved plan (`Free`, `Plus`, or `Business`), quota decision, and remaining quota summary
- **Compatibility rule**: Migration required for any current workspace behavior that depends on the temporary business flag; existing CV upload queue contracts must remain unchanged unless separately planned.
- **Validation rule**: AI work may proceed only after the gateway confirms an active entitlement, a valid context, allowed feature permission, and remaining quota for that context.

### Service Boundary Notes

- **API Gateway**: Owns plan catalog, subscription state, workspace entitlement, role-aware member management, quota decisions, and user-visible subscription status.
- **CV Parser**: Does not own subscription policy; if it receives AI work, the request must already be authorized by the gateway entitlement decision.
- **Notification**: Out of scope unless a later plan adds subscription lifecycle emails or workspace invitation notifications.

### Data / Schema Changes

- **Entity**: Subscription plan catalog
- **Attributes**: plan name, plan scope (`personal` or `workspace`), billing period, feature permissions, daily quota, Free trial total limit
- **Ownership**: API Gateway
- **Migration impact**: Migration and seed/update path needed

- **Entity**: User subscription
- **Attributes**: user, plan, status, period start, period end, renewal or expiry state
- **Ownership**: API Gateway
- **Migration impact**: Migration needed; existing users must receive Free entitlement

- **Entity**: Workspace subscription or entitlement
- **Attributes**: workspace, purchaser, plan, status, period start, period end, workspace quota limit
- **Ownership**: API Gateway
- **Migration impact**: Migration needed; current business-enabled workspaces need a migration decision during implementation planning

- **Entity**: AI usage record
- **Attributes**: actor, context type, workspace when applicable, resolved plan, AI action, usage date, count consumed, decision outcome
- **Ownership**: API Gateway
- **Migration impact**: Migration needed for reliable quota enforcement and auditability

### Operational Requirements

- **Security**: Only authenticated users can view or use personal entitlements; only authorized workspace admins can manage Business workspace subscription, invitations, and role assignment.
- **Observability**: Subscription changes, quota denials, quota consumption, workspace activation, and role changes must be auditable.
- **Failure behavior**: If entitlement or quota cannot be verified, AI scoring or analysis must fail closed with a clear user-facing reason and must not consume quota.
- **Config**: Plan limits for this release are Free 15 total trial and 5 daily, Plus 20 daily, and Business 500 daily per workspace.

### Validation Expectations

- **Gateway**: Validate account default plan, plan transitions, context-based quota resolution, workspace activation, member invitation, role assignment, quota exhaustion, and status display.
- **Parser**: Validate only if implementation changes the AI work contract; parser must not become the owner of subscription policy.
- **Notification**: Validate only if lifecycle notifications are introduced in a later feature.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of newly created accounts receive an active Free personal entitlement without manual operator action.
- **SC-002**: Free, Plus, and Business quota checks block requests at the documented limits: Free 15 total and 5 daily, Plus 20 daily, Business 500 daily per workspace.
- **SC-003**: In tests covering users with both Plus and Business membership, 100% of personal actions consume personal quota and 100% of workspace actions consume workspace quota.
- **SC-004**: Workspace member invitations under Business accept only existing accounts and reject non-account emails consistently.
- **SC-005**: Users and workspace admins can see current plan and remaining daily quota before or after an AI action.
- **SC-006**: Current workspace Business behavior is migrated without silently granting workspace entitlements to users who only have Plus.

## Assumptions

- Plus and Business subscriptions are monthly plans with one-month entitlement windows.
- Free is a personal account entitlement and does not expire, but its trial total limit applies only to Free AI scoring.
- Business is workspace-scoped; a user may purchase or administer more than one Business workspace, and each workspace has its own daily quota.
- AI scoring and CV fit analysis count as AI requests for quota purposes unless a later plan splits request types.
- "Personal space" means actions performed without a workspace context; "workspace space" means actions explicitly tied to a workspace.
- Payment provider, checkout flow, pricing, invoices, taxes, refunds, and dunning are out of scope for this specification unless added in a later feature.
- Existing CV upload queue contracts continue to use bucket and file key where applicable; this subscription feature must not introduce direct file URL contracts.
