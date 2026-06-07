# Quickstart Validation Guide: Workspace Multi-Tenancy

This guide details runnable verification steps to validate that Workspace Multi-Tenancy acts as a secure data isolation and access control boundary in the local environment.

## Prerequisites

Before running the validations, ensure the infrastructure services (PostgreSQL, RabbitMQ, Redis) are running:
```bash
docker-compose up -d
```
Generate the updated database client and apply migrations:
```bash
cd api-gateway
npx prisma generate
npx prisma migrate dev
```

---

## 1. Automatic Personal Workspace Provisioning Validation

### Step-by-Step Scenario
1. Send a POST request to `/auth/signup` to register a new user:
   ```bash
   curl -X POST http://localhost:3000/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"tenant.owner@example.com","password":"SecurePassword123!","fullName":"Tenant Owner","role":"RECRUITER"}'
   ```
2. Query the PostgreSQL database to check database state:
   ```sql
   SELECT u.id, u.email, u.active_workspace_id, w.name, w.is_business, wm.role, wm.status
   FROM users u
   JOIN workspace_members wm ON u.id = wm.user_id
   JOIN workspaces w ON wm.workspace_id = w.id
   WHERE u.email = 'tenant.owner@example.com';
   ```
### Expected Outcome
* The query returns one row.
* A Workspace named `Tenant Owner - Personal Workspace` has been created.
* `is_business` is `false`.
* `active_workspace_id` on the `User` matches the `Workspace` ID.
* The user's membership `role` is `OWNER` and `status` is `ACTIVE`.

---

## 2. Multi-Tenant Data Isolation Validation

### Step-by-Step Scenario
1. Authenticate User A (Workspace A) and User B (Workspace B), obtaining access tokens (set as cookies `access_token`).
2. User A creates a job post:
   ```bash
   curl -X POST http://localhost:3000/jobs \
     -H "Cookie: access_token=USER_A_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"title":"Software Engineer","description":"Write typescript code"}'
   ```
   *Note the returned Job ID.*
3. User B attempts to read the created Job ID:
   ```bash
   curl -X GET http://localhost:3000/jobs/JOB_ID_FROM_USER_A \
     -H "Cookie: access_token=USER_B_TOKEN"
   ```
4. User B attempts to list all jobs:
   ```bash
   curl -X GET http://localhost:3000/jobs \
     -H "Cookie: access_token=USER_B_TOKEN"
   ```

### Expected Outcome
* Step 2 returns `201 Created` with a new Job ID.
* Step 3 returns `404 Not Found` (rather than a 403, to prevent exposing resource existence to unauthorized tenants).
* Step 4 returns an empty list `[]` (assuming User B has not created any jobs), verifying 0% data leakage.

---

## 3. Secure Member Invitation Flow Validation

### Step-by-Step Scenario
1. User A (Owner of Personal Workspace A, `isBusiness = false`) attempts to invite a user:
   ```bash
   curl -X POST http://localhost:3000/workspaces/WORKSPACE_A_ID/invitations \
     -H "Cookie: access_token=USER_A_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email":"invitee@example.com","role":"RECRUITER"}'
   ```
2. User A upgrades Workspace A to a business subscription by setting `isBusiness = true` (or creates/joins a Business Workspace B).
3. User A sends an invitation to `invitee@example.com` in Business Workspace B:
   ```bash
   curl -X POST http://localhost:3000/workspaces/WORKSPACE_B_ID/invitations \
     -H "Cookie: access_token=USER_A_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email":"invitee@example.com","role":"RECRUITER"}'
   ```
   *Note the generated token in the DB or RabbitMQ logs.*
4. Retrieve the token from the `workspace_invitations` table. The invitee registers (obtaining an access token) and calls the acceptance endpoint:
   ```bash
   curl -X POST http://localhost:3000/workspaces/invitations/accept \
     -H "Cookie: access_token=INVITEE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"token":"TOKEN_FROM_DB"}'
   ```

### Expected Outcome
* Step 1 returns `403 Forbidden` (Invitations are blocked on Personal Workspaces).
* Step 3 returns `201 Created`. The `workspace_members` table shows the invited user with `status = INVITED`. RabbitMQ publisher receives a `workspace.member.invited` message.
* Step 4 returns `200 OK`. The invited user's membership status updates to `ACTIVE`, `activeWorkspaceId` is set to the new workspace, and the `WorkspaceInvitation` token row is deleted.
