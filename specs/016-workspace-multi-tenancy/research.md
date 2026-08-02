# Research & Architecture Decisions: Workspace Multi-Tenancy

## 1. Workspace Context Resolution Mechanism
* **Decision**: Implement a custom `WorkspaceContextGuard` which extracts `x-workspace-id` from header or falls back to JWT/User active workspace, then binds it to both the request object and NestJS CLS (`nestjs-cls`).
* **Rationale**: 
  - Using a NestJS Guard allows us to validate the tenant boundary at the request entrypoint and fail fast with a `403 Forbidden` if the user is not a member of the workspace.
  - Injecting it into CLS makes the workspace context accessible globally during the request lifecycle, ensuring audit logs and down-stream async operations can access it without manual propagation.
* **Alternatives Considered**: 
  - **Prisma Middleware/Extensions**: Automatically intercept all queries to inject `where: { workspaceId }`. Rejected because it makes it difficult to run system-level queries (e.g. background tasks or cross-tenant dashboard metrics by admin) and obscures execution paths during complex database transactions.
  - **Exclusively manual propagation**: Passing `workspaceId` as a parameter to every method. Rejected because it is highly error-prone and can easily lead to tenant leaks if a developer forgets to pass the parameter. A hybrid approach of resolving at the guard/CLS but allowing explicit parameter overrides in services is chosen.

## 2. Candidate Email Uniqueness
* **Decision**: Shift Candidate uniqueness from global email (`@unique` on email) to workspace-scoped uniqueness (`@@unique([workspaceId, email])`).
* **Rationale**: 
  - In a B2B SaaS platform, different tenants (workspaces) must be able to manage candidate pools independently. If candidate emails are unique globally, Tenant A creating a candidate with `candidate@gmail.com` would block Tenant B from creating a candidate with the same email.
  - Making candidates unique per workspace ensures strict isolation.
* **Alternatives Considered**: 
  - **Global Candidate Profile with M:N Workspace link**: Keep candidates global and share their profiles. Rejected due to data privacy and security regulations (e.g. GDPR/CCPA). A candidate's CV, resume text, and notes are proprietary information owned by the recruiting tenant and must never leak to other tenants.

## 3. Secure Member Invitation Acceptance Flow
* **Decision**: Implement a two-step invitation flow. When invited, a user's membership is created in `INVITED` status, and a secure `WorkspaceInvitation` token is generated. On acceptance (`POST /workspaces/invitations/accept`), the status transitions to `ACTIVE` and the token is deleted.
* **Rationale**: 
  - Instant addition of users to workspaces without confirmation allows a bad actor to force users into unsolicited workspaces and leads to privacy issues.
  - Explicit consent via signed tokens is an industry best practice for SaaS enterprise onboarding.
* **Alternatives Considered**: 
  - **Instant Activation**: Automatically joining invited users as active members (the current legacy behavior). Rejected as it fails enterprise-grade compliance and security requirements.
