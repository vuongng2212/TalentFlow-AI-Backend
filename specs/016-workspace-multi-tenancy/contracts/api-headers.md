# API Headers & Context Resolution: Workspace Multi-Tenancy

This contract defines the custom request headers and active workspace parameters used by client applications to scope HTTP REST requests.

## 1. Custom HTTP Headers

To operate within a specific workspace context, HTTP requests sent to the API Gateway can include the following custom header:

* **Header Name**: `x-workspace-id`
* **Format**: UUIDv4 String
* **Required**: Optional (if omitted, falls back to the database-driven active workspace context resolution).
* **Behavior**:
  * If the header is provided, the API Gateway resolves the request's context to this specific workspace.
  * If the authenticated user is not a member of the workspace identified by `x-workspace-id` or has an inactive membership status (e.g. `INVITED` or `REMOVED`), the request is immediately rejected with a `403 Forbidden` error.

---

## 2. Context Fallback Resolution Order

For endpoints requiring a workspace context, if the client does not send the `x-workspace-id` header, the backend resolves the tenant ID using the following fallback order:

1. **User Active Workspace**:
   * Retrieve the `activeWorkspaceId` column from the authenticated `User` record in the database.
   * If set, evaluate the user's membership in that workspace. If active, resolve the context to this ID.
2. **First Active Membership**:
   * If `activeWorkspaceId` is null or invalid, query the `WorkspaceMember` table for the user's memberships where `status = ACTIVE`.
   * Fallback to the first workspace membership found in alphabetical or creation order.
   * Update the user's `activeWorkspaceId` in the database to this resolved workspace ID.
3. **No Workspace Found (Terminal Edge Case)**:
   * If the user has no active workspace memberships, the guard throws a `400 Bad Request` indicating the user has no accessible workspaces.

The resolved workspace context is then bound to:
* `request.workspaceId` for direct Express access in controllers/middleware.
* `ClsService.get('workspaceId')` for global access throughout the request lifecycle (audit logs, async operations, RabbitMQ publishers).

---

## 3. Workspace-Scoped RBAC

In addition to context resolution, the system enforces workspace role-based access control (RBAC) via the `WorkspaceRolesGuard` and `@WorkspaceRoles()` decorator.

* **Roles Enum**: `WorkspaceMemberRole` (`OWNER`, `ADMIN`, `RECRUITER`, `VIEWER`)
* **Default Behavior**:
  * `OWNER` and `ADMIN` can manage members (invite, accept, remove).
  * `OWNER`, `ADMIN`, and `RECRUITER` can create, update, and delete resources (Jobs, Candidates, etc.).
  * `VIEWER` is read-only.
* **Usage**:
  ```typescript
  @WorkspaceRoles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  @Post('invitations')
  createInvitation() { ... }
  ```

---

## 4. Swagger/OpenAPI Configuration

All endpoints mapped to recruiter-facing operations must document the custom header parameters for explicit API exposure.

* **Swagger OpenAPI Parameter definition**:
  ```yaml
  name: x-workspace-id
  in: header
  description: The target workspace ID to scope the recruitment resources. If not provided, falls back to the active workspace.
  required: false
  schema:
    type: string
    format: uuid
  ```
* **NestJS Decorator mapping**:
  ```typescript
  @ApiHeader({
    name: 'x-workspace-id',
    required: false,
    description: 'Active workspace ID for resource isolation',
  })
  ```
