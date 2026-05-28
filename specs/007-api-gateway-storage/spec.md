---
status: migrated
---

# Feature Specification: API Gateway Storage

**Feature Branch**: `007-api-gateway-storage`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/storage/**`, the applications upload flow, and the storage service tests.

## Problem Statement

The API Gateway needs a storage boundary that can upload files to object storage, generate signed URLs for temporary access, delete files, and expose the configured bucket name for downstream contracts. This utility layer is the storage foundation for CV uploads and other file-backed gateway workflows, so it must preserve the existing URL-building rules and production configuration checks.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: Background utility service / file-storage boundary
- **Data boundary**: Object storage files and bucket configuration
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload Stored Files (Priority: P1)

The gateway can upload a file to object storage and return the stored location using the configured bucket and endpoint rules.

**Why this priority**: Upload is the core storage capability and the basis for the CV upload pipeline.  
**Independent Test**: Call the storage upload method with a buffer, object key, and content type, then verify the file is written and the returned URL matches the current public URL or endpoint-building rules.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a valid buffer, object key, and content type, **When** the upload operation runs, **Then** the gateway stores the file and returns the file key plus a usable URL.
2. **Given** a configured public URL, **When** the file is uploaded, **Then** the returned URL uses the public base path.
3. **Given** no public URL but a valid endpoint or account id, **When** the file is uploaded, **Then** the returned URL is built from the configured endpoint and bucket.

### User Story 2 - Generate Temporary Access Links (Priority: P2)

The gateway can generate signed URLs for previously uploaded files.

**Why this priority**: Signed URLs provide controlled access to private files without exposing raw credentials or permanent public paths.  
**Independent Test**: Call the signed-URL method with a stored key and verify a time-limited URL is returned.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a stored file key, **When** the signed-URL method runs, **Then** the gateway returns a presigned URL for that object.
2. **Given** a custom expiry value, **When** the signed-URL method runs, **Then** the returned link uses the requested expiration window.
3. **Given** storage is unavailable, **When** the signed-URL request fails, **Then** the gateway surfaces the failure rather than inventing a fallback URL.

### User Story 3 - Delete Files And Enforce Storage Safety (Priority: P3)

The gateway can delete stored files and enforce safe runtime configuration in production.

**Why this priority**: Deletion and configuration safety are the guardrails that keep the storage utility predictable and safe in production.  
**Independent Test**: Call the delete operation and verify the object is removed; then verify production-only config constraints are enforced during service initialization.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a stored file key, **When** the delete operation runs, **Then** the gateway deletes the object from storage.
2. **Given** a production runtime, **When** credentials or endpoint settings are missing or insecure, **Then** the gateway fails fast during service initialization.
3. **Given** a storage client shutdown, **When** the module is destroyed, **Then** the gateway destroys the underlying client cleanly.

## Edge Cases

- Upload URLs must honor the configured public URL when present.
- When no public URL exists, upload URLs must be constructed from the configured endpoint, bucket, and key.
- Production requires credentials and an HTTPS-compatible endpoint.
- Production must reject startup when neither `R2_ENDPOINT` nor `R2_ACCOUNT_ID` is configured.
- Signed URL generation must not silently degrade to a public link when storage signing fails.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST upload objects to the configured bucket and return the stored key plus a resolved URL.
- **FR-002**: The gateway MUST generate presigned URLs for stored objects with the configured or requested expiry window.
- **FR-003**: The gateway MUST delete stored objects when requested.
- **FR-004**: The gateway MUST expose the configured bucket name so downstream contracts can publish bucket-based references.
- **FR-005**: The gateway MUST enforce production configuration rules for storage credentials and endpoint security.
- **FR-006**: The gateway MUST preserve the current URL-building fallback order: public URL, account-based endpoint, then localhost for development.

### Cross-Service Contracts

- **Producer**: API Gateway upload flows, especially applications that store CVs
- **Consumer**: Object storage service (R2/MinIO) and downstream queue/event producers that need bucket names
- **Payload shape**: Upload bytes plus object key and content type; delete and signed-url operations by key; bucket name returned by the service for contract publishing
- **Compatibility rule**: Backward-compatible with existing object key and URL-building behavior
- **Validation rule**: Production initialization must verify credentials and endpoint rules before storage operations are used

### Data / Schema Changes

- **Entity**: Object storage file reference
- **Attributes**: Bucket name, object key, content type, resolved URL, signed URL expiry
- **Ownership**: API Gateway storage utility plus external object storage provider
- **Migration impact**: None

### Operational Requirements

- **Security**: Keep object storage private by default, require signed URLs for temporary access, and fail production startup on insecure or incomplete config.
- **Observability**: Preserve upload, delete, and destroy logging so storage operations remain traceable.
- **Failure behavior**: Surface upload, delete, or signing failures instead of masking them with placeholder URLs or silent success.
- **Config**: `R2_ENDPOINT`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `TIMEOUT_MS`, and `NODE_ENV` must remain available and validated by the existing config rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A valid upload call returns a key and URL that match the configured public or endpoint-based path.
- **SC-002**: Signed URL generation returns a time-limited link for stored objects.
- **SC-003**: Delete removes stored objects and the storage client shuts down cleanly when the module is destroyed.
- **SC-004**: Production configuration failures are detected during initialization rather than later at request time.

## Assumptions

- The API Gateway remains the canonical owner of the storage utility used by file-backed workflows.
- Object storage is provided by R2-compatible infrastructure in production and MinIO-compatible infrastructure in local development.
- The storage bucket is already provisioned and its name is treated as runtime configuration.
- Downstream features depend on the service's existing bucket-based URL and signed-URL behavior rather than direct file URLs.