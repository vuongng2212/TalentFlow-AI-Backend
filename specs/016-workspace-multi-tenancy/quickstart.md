# Quickstart Validation Guide: Workspace Multi-Tenancy

This guide details runnable verification steps to validate that Workspace Multi-Tenancy acts as a secure data isolation and access control boundary in the local environment.

## Prerequisites

Before running the validations, ensure the infrastructure services (PostgreSQL, RabbitMQ, Redis) are running:
```bash
docker-compose up -d
```

Apply the workspace multi-tenancy migration:
```bash
cd api-gateway
npx prisma migrate deploy
npx prisma generate
```

Generate the notification service Prisma client (no schema change but ensure consistency):
```bash
cd ../notification
npx prisma generate
```

Ensure your `.env` has the new configuration:
```bash
WORKSPACE_INVITATION_EXPIRY_DAYS=7
WORKSPACE_INVITE_BASE_URL=http://localhost:3001/invite/accept
```

Start both services in development:
```bash
# Terminal 1
cd api-gateway && npm run start:dev

# Terminal 2
cd notification && npm run start:dev
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

## 2. Workspace Context Resolution Validation

### Step-by-Step Scenario
1. With the same authenticated user, call `PATCH /users/active-workspace` with a different workspace ID to verify the active workspace can be updated.
2. Send `GET /jobs` without the `x-workspace-id` header and verify the response uses the new active workspace.
3. Send `GET /jobs` with `x-workspace-id: <other-workspace-uuid>` where the user is not a member and verify a 403 response.

### Expected Outcome
* Step 1 returns `200 OK` with the updated user payload.
* Step 2 returns jobs from the newly active workspace.
* Step 3 returns `403 Forbidden` because the user is not an active member.

---

## 3. Multi-Tenant Data Isolation Validation

### Step-by-Step Scenario
1. Authenticate User A (Workspace A) and User B (Workspace B), obtaining access tokens.
2. User A creates a job post in their workspace:
   ```bash
   curl -X POST http://localhost:3000/jobs \
     -H "Cookie: access_token=USER_A_TOKEN" \
     -H "x-workspace-id: WORKSPACE_A_ID" \
     -H "Content-Type: application/json" \
     -d '{"title":"Software Engineer","description":"Write typescript code"}'
   ```
3. User B attempts to read the created Job ID using the correct job UUID but a different workspace:
   ```bash
   curl -X GET http://localhost:3000/jobs/JOB_ID_FROM_USER_A \
     -H "Cookie: access_token=USER_B_TOKEN" \
     -H "x-workspace-id: WORKSPACE_B_ID"
   ```
4. User B attempts to list all jobs in their workspace:
   ```bash
   curl -X GET http://localhost:3000/jobs \
     -H "Cookie: access_token=USER_B_TOKEN" \
     -H "x-workspace-id: WORKSPACE_B_ID"
   ```

### Expected Outcome
* Step 2 returns `201 Created` with a new Job ID.
* Step 3 returns `404 Not Found` (rather than a 403, to prevent exposing resource existence to unauthorized tenants).
* Step 4 returns an empty list `[]` (assuming User B has not created any jobs in Workspace B), verifying 0% data leakage.

---

## 4. Workspace-Scoped RBAC Validation

### Step-by-Step Scenario
1. Add a `VIEWER` to Workspace A.
2. The `VIEWER` attempts to create a job:
   ```bash
   curl -X POST http://localhost:3000/jobs \
     -H "Cookie: access_token=VIEWER_TOKEN" \
     -H "x-workspace-id: WORKSPACE_A_ID" \
     -H "Content-Type: application/json" \
     -d '{"title":"Junior Engineer","description":"..."}'
   ```
3. The `VIEWER` attempts to list jobs:
   ```bash
   curl -X GET http://localhost:3000/jobs \
     -H "Cookie: access_token=VIEWER_TOKEN" \
     -H "x-workspace-id: WORKSPACE_A_ID"
   ```

### Expected Outcome
* Step 2 returns `403 Forbidden` (WorkspaceRolesGuard blocks the write).
* Step 3 returns `200 OK` (read access is allowed).

---

## 5. Secure Member Invitation Flow Validation

### Step-by-Step Scenario
1. User A (Owner of Personal Workspace A, `isBusiness = false`) attempts to invite a user:
   ```bash
   curl -X POST http://localhost:3000/workspaces/WORKSPACE_A_ID/invitations \
     -H "Cookie: access_token=USER_A_TOKEN" \
     -H "x-workspace-id: WORKSPACE_A_ID" \
     -H "Content-Type: application/json" \
     -d '{"email":"invitee@example.com","role":"RECRUITER"}'
   ```
2. Create a new Business Workspace B (or update A's `is_business` flag in the database).
3. User A sends an invitation to `invitee@example.com` in Business Workspace B:
   ```bash
   curl -X POST http://localhost:3000/workspaces/WORKSPACE_B_ID/invitations \
     -H "Cookie: access_token=USER_A_TOKEN" \
     -H "x-workspace-id: WORKSPACE_B_ID" \
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
* Step 3 returns `201 Created`. The `workspace_members` table shows the invited user with `status = INVITED`. RabbitMQ publisher receives a `workspace.member.invited` message and the notification service sends the invitation email.
* Step 4 returns `200 OK`. The invited user's membership status updates to `ACTIVE`, `activeWorkspaceId` is set to the new workspace, and the `WorkspaceInvitation` token row is deleted.

---

## 6. Email Template Validation

Confirm the `workspace-invitation` Handlebars template renders correctly with the supplied data:
```bash
cd notification && npx ts-node -e "
const Handlebars = require('handlebars');
const fs = require('fs');
const tpl = Handlebars.compile(fs.readFileSync('src/email/templates/workspace-invitation.hbs', 'utf8'));
console.log(tpl({ workspaceName: 'Acme Corp', inviteUrl: 'https://talentflow.ai/invite/accept?token=abc' }));
"
```

The rendered subject and body should include the workspace name and the invite URL.
