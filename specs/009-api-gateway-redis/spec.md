---
status: migrated
---

# Feature Specification: API Gateway Redis

**Feature Branch**: `009-api-gateway-redis`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/redis/**`, the gateway auth/session flows, and the Redis service tests.

## Problem Statement

The API Gateway needs a Redis boundary that can provide persistent key-value state for login attempts, refresh tokens, and other runtime coordination data while failing fast when the Redis connection is not configured. This utility layer backs auth and other gateway stateful workflows, so it must keep the existing TTL, increment, existence, and shutdown behavior intact.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: Background utility service / state-store boundary
- **Data boundary**: Redis key-value state
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initialize Redis Access (Priority: P1)

The gateway can initialize a Redis client from configuration and expose a usable connection for dependent services.

**Why this priority**: The Redis connection must exist before any auth session or lockout state can be stored.  
**Independent Test**: Construct the Redis service with a valid `REDIS_URL` and verify the client is created; then verify service construction fails fast when the URL is missing.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a valid Redis URL, **When** the service initializes, **Then** the gateway creates a Redis client.
2. **Given** a missing Redis URL, **When** the service initializes, **Then** the gateway fails fast with a clear configuration error.
3. **Given** a running Redis client, **When** another service requests the underlying client, **Then** the gateway returns the client instance.

### User Story 2 - Read And Write Runtime State (Priority: P2)

The gateway can read, write, delete, increment, expire, and inspect Redis keys for auth and session workflows.

**Why this priority**: These operations are the core primitives that auth lockout, refresh-token state, and other runtime coordination flows depend on.  
**Independent Test**: Call the Redis helper methods and verify they forward to the underlying client with the correct TTL and existence semantics.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a key and value, **When** the gateway stores the value with a TTL, **Then** the Redis client uses the expected expiration semantics.
2. **Given** a key that needs to be incremented or checked for existence, **When** the operation runs, **Then** the gateway returns the client result without altering the contract.
3. **Given** a key that has or lacks expiration, **When** TTL is requested, **Then** the gateway returns the Redis TTL value as-is.

### User Story 3 - Health And Shutdown (Priority: P3)

The gateway can ping Redis and shut the client down cleanly.

**Why this priority**: Ping and shutdown behavior keep the utility observable and prevent connection leaks during service teardown.  
**Independent Test**: Call `ping` and `onModuleDestroy` and verify the Redis client responds and then quits cleanly.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an active Redis client, **When** the ping method runs, **Then** the gateway returns `PONG`.
2. **Given** the module is shutting down, **When** the destroy hook runs, **Then** the gateway quits the Redis client cleanly.
3. **Given** the client is needed by dependent services, **When** the gateway exposes the client, **Then** it returns the same underlying Redis instance.

## Edge Cases

- `REDIS_URL` must be present or service construction fails immediately.
- TTL-backed writes must use expiration semantics when a TTL is supplied.
- TTL inspection must preserve Redis return values such as `-1` and `-2` when relevant.
- The service should not hide client-level errors behind a fake in-memory fallback.
- Shutdown must quit the underlying client rather than leaving a dangling connection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST create a Redis client from the configured Redis URL and MUST fail fast if the URL is missing.
- **FR-002**: The gateway MUST support basic key-value operations needed by dependent services, including set, get, delete, exists, increment, expire, TTL, and ping.
- **FR-003**: The gateway MUST honor TTL semantics when a TTL is provided to the set operation.
- **FR-004**: The gateway MUST expose the underlying client for dependent gateway services that need direct Redis access.
- **FR-005**: The gateway MUST quit the Redis client cleanly during module shutdown.
- **FR-006**: The gateway MUST preserve the current client-level return values and not remap Redis semantics.

### Cross-Service Contracts

- **Producer**: API Gateway auth, queue, and other stateful services using Redis helpers
- **Consumer**: Redis server and any dependent gateway service that reads or writes state
- **Payload shape**: Redis keys and string values with optional TTL, plus existence and increment operations
- **Compatibility rule**: Backward-compatible; keep the existing key-value helper surface and semantics intact
- **Validation rule**: Configuration must provide a Redis URL before the service is constructed

### Data / Schema Changes

- **Entity**: Redis key-value state
- **Attributes**: Key, value, TTL, existence, increment count
- **Ownership**: API Gateway Redis utility and external Redis server
- **Migration impact**: None

### Operational Requirements

- **Security**: Keep sensitive runtime state in Redis rather than in process memory.
- **Observability**: Preserve the connection lifecycle through the service's existing runtime behavior and dependent service logs.
- **Failure behavior**: Fail fast on missing config, and let Redis client operations surface their own errors rather than masking them.
- **Config**: `REDIS_URL` must remain available and validated by the existing config rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Redis service initializes successfully when a valid `REDIS_URL` is present.
- **SC-002**: Dependent gateway services can store and retrieve TTL-backed state with the expected Redis semantics.
- **SC-003**: Redis ping returns `PONG` and shutdown quits the underlying client cleanly.
- **SC-004**: Missing Redis configuration is detected during initialization rather than later in the request flow.

## Assumptions

- The API Gateway remains the canonical owner of the Redis helper used by auth and other stateful workflows.
- Redis is used for transient runtime state such as refresh tokens and lockout counters rather than primary business persistence.
- The helper is intentionally thin and should not wrap Redis semantics into a separate abstraction layer.
- Dependent services expect direct Redis-style return values and TTL semantics.