---
name: nestjs-review
description: "Review rules for NestJS and TypeScript services (API Gateway, Notification)."
applyTo: "api-gateway/**, notification/**"
---

# NestJS & TypeScript Review Standards

## DTOs & Validation

- Every request body MUST have a dedicated DTO class.
- Use `class-validator` decorators for all fields.
- For nested objects, use a dedicated DTO and `@ValidateNested()`.
- Ensure all DTOs are documented with `@ApiProperty` (Swagger).

## Typing

- **CRITICAL**: No `any` types allowed. Use interfaces, types, or explicit DTOs.
- Avoid non-null assertions (`!`) unless truly safe.
- Prefer `readonly` for DTO properties.

## Database (Prisma)

- Check that schema changes align with the business logic.
- Flag N+1 queries; suggest `include` or batching.
- Verify that migrations are included for any schema modification.

## Security & Auth

- Routes must be protected by `JwtAuthGuard` unless marked with `@Public()`.
- Check for proper RBAC using `@Roles(Role.ADMIN)`.
- Flag any manual JWT parsing; suggest using the standard guards.

## Error Handling

- Use standard NestJS exceptions: `NotFoundException`, `BadRequestException`, `ConflictException`.
- Ensure PII (email, phone) is masked in logs using the service-local utility: `sanitize`/`sanitizeError` in `api-gateway`, `maskPii` in `notification`.
- Never leak database error details or stack traces to the client.

## Swagger

- Every public endpoint MUST have `@ApiOperation` and response decorators.
- Enums MUST have `enumName` and a clear `description`.
