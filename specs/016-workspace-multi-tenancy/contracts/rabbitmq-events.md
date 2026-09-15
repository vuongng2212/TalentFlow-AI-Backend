# RabbitMQ Messaging Contracts: Workspace Multi-Tenancy

This contract defines the messaging schema for asynchronous multi-tenant workspace events published from the API Gateway and consumed by the Notification service.

## 1. Member Invitation Event

* **Routing Key**: `workspace.member.invited`
* **Exchange**: `talentflow.events` (Topic Exchange)
* **Publisher**: API Gateway (`api-gateway/`)
* **Consumer**: Notification Service (`notification/`)
* **Purpose**: Dispatching an onboarding verification email to the invited user with a secure token-based acceptance link.

### Message Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "WorkspaceMemberInvitedEvent",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email",
      "description": "The email address of the invited member"
    },
    "workspaceName": {
      "type": "string",
      "description": "The display name of the workspace they are invited to join"
    },
    "token": {
      "type": "string",
      "description": "Cryptographically secure string token used to accept the invitation"
    },
    "inviteUrl": {
      "type": "string",
      "format": "uri",
      "description": "Direct frontend URL link where the user can accept the invitation"
    }
  },
  "required": [
    "email",
    "workspaceName",
    "token",
    "inviteUrl"
  ]
}
```

### Event Payload Example

```json
{
  "email": "candidate.recruiter@example.com",
  "workspaceName": "Acme Corp - Tech Recruitment",
  "token": "d748f3b1-21ac-46bd-991c-2ee9a184f42f",
  "inviteUrl": "https://talentflow.ai/invite/accept?token=d748f3b1-21ac-46bd-991c-2ee9a184f42f"
}
```

### TypeScript Interface (Producer)

```typescript
// api-gateway/src/queue/interfaces/workspace-member-invited-event.interface.ts
export interface WorkspaceMemberInvitedEvent {
  email: string;
  workspaceName: string;
  token: string;
  inviteUrl: string;
}
```

### Class-Validator DTO (Consumer)

```typescript
// notification/src/rabbitmq/dtos/workspace-member-invited.dto.ts
export class WorkspaceMemberInvitedDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  workspaceName!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  inviteUrl!: string;
}
```

---

## 2. Queue Topology

* The notification service must bind its existing queue (e.g. `notification.queue` or `NOTIFICATION_EVENTS_QUEUE`) to the `talentflow.events` exchange using the routing key `workspace.member.invited`.
* The consumer must validate the payload using `class-validator` with `whitelist: true` and `forbidNonWhitelisted: true`.
* Malformed messages must be nacked (`requeue: false`) so they are routed to the DLQ.
