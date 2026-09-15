# Data Model Specification: Workspace Multi-Tenancy

This document defines the entity schema changes and relationships for B2B multi-tenancy.

## 1. Entity Definitions & Relationships

```mermaid
erDiagram
    User ||--o{ WorkspaceMember : memberOf
    User ||--o? Workspace : activeWorkspace
    Workspace ||--o{ WorkspaceMember : hasMembers
    Workspace ||--o{ Job : isolates
    Workspace ||--o{ Candidate : isolates
    Workspace ||--o{ WorkspaceInvitation : invites
    Workspace ||--o{ EmailTemplate : isolates
    Job ||--o{ Application : has
    Application ||--o{ Interview : has
    WorkspaceMember }|--|| WorkspaceMemberRole : hasRole
    WorkspaceMember }|--|| WorkspaceMemberStatus : hasStatus
```

### User (Modified)
Represents a user account in the system.
* **Fields**:
  * `id`: `String` (UUID, Primary Key)
  * `email`: `String` (Unique)
  * `activeWorkspaceId`: `String?` (Foreign Key, references `Workspace.id`, nullable)
* **Relations**:
  * `workspaceMembers`: `WorkspaceMember[]` (One-to-Many)
  * `activeWorkspace`: `Workspace?` (Many-to-One)

### Workspace (Modified)
Represents a tenant organization.
* **Fields**:
  * `id`: `String` (UUID, Primary Key)
  * `name`: `String`
  * `isBusiness`: `Boolean` (Default: `false`, controls invitation flow)
* **Relations**:
  * `members`: `WorkspaceMember[]` (One-to-Many)
  * `jobs`: `Job[]` (One-to-Many)
  * `candidates`: `Candidate[]` (One-to-Many)
  * `applications`: `Application[]` (One-to-Many)
  * `interviews`: `Interview[]` (One-to-Many)
  * `emailTemplates`: `EmailTemplate[]` (One-to-Many)
  * `invitations`: `WorkspaceInvitation[]` (One-to-Many)

### WorkspaceMember (Modified)
Represents the membership state of a user within a workspace.
* **Fields**:
  * `id`: `String` (UUID, Primary Key)
  * `workspaceId`: `String` (Foreign Key, references `Workspace.id`)
  * `userId`: `String` (Foreign Key, references `User.id`)
  * `role`: `WorkspaceMemberRole` (Enum: `OWNER`, `ADMIN`, `RECRUITER`, `VIEWER`)
  * `status`: `WorkspaceMemberStatus` (Enum: `ACTIVE`, `INVITED`, `REMOVED`)
  * `invitedById`: `String?` (Foreign Key, references `User.id`, nullable)
* **Constraints**:
  * Unique composite index on `(workspaceId, userId)`.

### WorkspaceInvitation (New)
Manages pending invitation tokens for workspace onboarding.
* **Fields**:
  * `id`: `String` (UUID, Primary Key)
  * `email`: `String`
  * `workspaceId`: `String` (Foreign Key, references `Workspace.id`)
  * `token`: `String` (Unique, cryptographically secure string/UUID)
  * `expiresAt`: `DateTime` (Expiration date, typically `createdAt + 7 days`)
  * `invitedById`: `String` (Foreign Key, references `User.id`)
  * `createdAt`: `DateTime` (Default: `now()`)
* **Constraints**:
  * Unique constraint on `token`.
  * Index on `(email)`.

### EmailTemplate (New)
Pre-defined email responses scoped to workspaces.
* **Fields**:
  * `id`: `String` (UUID, Primary Key)
  * `name`: `String`
  * `subject`: `String`
  * `body`: `String` (Text template body)
  * `workspaceId`: `String` (Foreign Key, references `Workspace.id`)
* **Constraints**:
  * Unique composite index on `(workspaceId, name)`.

### Job, Candidate, Application, Interview (Modified)
Core recruitment entities scoped to tenants.
* **Added Fields**:
  * `workspaceId`: `String` (Foreign Key, references `Workspace.id`, Cascade on Delete, Required)
* **Candidate Unique Constraints**:
  * Replaced global unique index `@unique` on `email` with composite unique index `@@unique([workspaceId, email])`.

---

## 2. Validation & Business Rules

* **Signup Provisioning**:
  * When a user signs up, the system must atomically create:
    1. The `User` record.
    2. A `Workspace` named `[fullName] - Personal Workspace` with `isBusiness = false`.
    3. A `WorkspaceMember` record with `role = OWNER` and `status = ACTIVE`.
    4. Set `activeWorkspaceId` on the `User` record pointing to the newly created workspace.
* **Invitation Scoping**:
  * Inviting members is only allowed if `Workspace.isBusiness === true`. Attempting to invite to `isBusiness === false` workspaces will throw a `403 Forbidden`.
* **Tenant Isolation**:
  * Database queries for Job, Candidate, Application, Interview, and EmailTemplate must filter records using the resolved `workspaceId`. No cross-workspace reading or writing is allowed.

## 3. State Transitions

### Workspace Membership Status

```text
       [Invited by Admin]
               |
               v
          +---------+
          | INVITED |
          +---------+
               |
      [Accepts via Token]
               |
               v
          +---------+
          | ACTIVE  | <---+ (Re-invited / Reactivated)
          +---------+     |
               |          |
      [Removed by Admin]  |
               |          |
               v          |
          +---------+     |
          | REMOVED | ----+
          +---------+
```
