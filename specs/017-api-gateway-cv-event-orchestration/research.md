# Phase 0: Outline & Research

## Decision: Event Routing and Queue Topology
- **Decision**: The API Gateway will consume `cv.parsed` and `cv.failed` from `talentflow.events` exchange.
- **Rationale**: `cv-parser` publishes to `talentflow.events` with routing key `cv.parsed`. We need a dedicated queue in API Gateway to consume this, e.g., `api_gateway.cv_events`.
- **Alternatives considered**: Reusing an existing queue, but a dedicated queue for CV events ensures isolation and independent scaling.

## Decision: Enriched Event Format & Destination
- **Decision**: API Gateway will publish `notification.send` event or specific `application.cv_parsed` event. Looking at the existing codebase, there's `notification.send` and `notification.events` queue. We will publish a strongly typed enriched event to `notification.events` or an appropriate routing key for the Notification service.
- **Rationale**: Keeps the notification service decoupled from domain specifics if we use generic `notification.send`, but domain events like `cv.parsing.success` are better. However, the spec states "publish an enriched success event... for the notification service to consume".
- **Alternatives considered**: Direct REST call, but queueing is more resilient.

## Decision: Database Schema Updates
- **Decision**: Add `cvParsingStatus` (enum: PENDING, PROCESSING, COMPLETED, FAILED), `aiScore` (Int?), `scoringReasoning` (String?), `parsedData` (Json?) to `Application` model.
- **Rationale**: Directly supports FR-001.

