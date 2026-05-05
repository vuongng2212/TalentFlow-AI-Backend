---
status: migrated
---

# Feature Specification: API Gateway Metrics

**Feature Branch**: `010-api-gateway-metrics`  
**Created**: 2026-05-05  
**Status**: Migrated  
**Input**: Reverse-engineered from `api-gateway/src/metrics/**`, the queue metrics collector, and the metrics service tests.

## Problem Statement

The API Gateway needs a metrics boundary that exposes Prometheus-formatted runtime metrics, records HTTP request timings and counts, and publishes RabbitMQ queue depth gauges for the CV upload pipeline. This observability layer must remain public, low-overhead, and compatible with the current registry and queue-collector behavior.

## Scope And Ownership

- **Primary service(s)**: API Gateway
- **Runtime boundary**: HTTP observability endpoint plus background metrics collection
- **Data boundary**: Prometheus registry and queue statistics
- **Legacy context**: Frozen planning sources may be consulted for background only; they are not active requirements.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Expose Prometheus Metrics (Priority: P1)

The gateway can expose a Prometheus metrics endpoint for runtime scraping.

**Why this priority**: The service needs a scrapeable observability endpoint before any metric collection is useful to operators.  
**Independent Test**: Call `GET /metrics` and verify the response is Prometheus text output with the expected content type.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** a request to the metrics endpoint, **When** the client calls it, **Then** the gateway returns Prometheus-formatted metrics as plain text.
2. **Given** the registry contains default and custom metrics, **When** the endpoint responds, **Then** the payload includes the registry contents rather than a synthetic summary.
3. **Given** the metrics endpoint is public, **When** an unauthenticated client calls it, **Then** the gateway still serves the metrics response.

### User Story 2 - Record HTTP Request Metrics (Priority: P2)

The gateway can record request duration and count metrics for HTTP traffic.

**Why this priority**: HTTP request timing and count metrics are the base signals needed to understand service load and latency.  
**Independent Test**: Call the request-recording method with method, path, status, and duration values and verify the Prometheus registry contains the expected histogram and counter samples.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** an HTTP request completes, **When** the gateway records it, **Then** the duration histogram and request counter are updated with method, path, and status labels.
2. **Given** requests with different statuses or durations, **When** metrics are recorded, **Then** the registry preserves the label distinctions and histogram buckets.
3. **Given** repeated requests to the same path, **When** they are recorded, **Then** the counter increments for each request.

### User Story 3 - Collect Queue Depth Metrics (Priority: P3)

The gateway can collect RabbitMQ queue depth and consumer-count metrics for the CV upload pipeline.

**Why this priority**: Queue depth metrics help operators see whether the CV pipeline is healthy and draining as expected.  
**Independent Test**: Initialize the queue collector, verify it polls queue stats, and confirm the gauges are populated in the Prometheus registry.  
**Service Ownership**: API Gateway

**Acceptance Scenarios**:

1. **Given** queue stats are available, **When** the collector runs, **Then** the gateway updates queue depth and consumer-count gauges.
2. **Given** the collector starts, **When** the poll interval is configured, **Then** the collector uses that interval and begins periodic collection.
3. **Given** the collector shuts down, **When** the module is destroyed, **Then** periodic polling stops cleanly.

## Edge Cases

- The metrics endpoint must always return Prometheus text rather than JSON.
- Queue metrics collection should handle empty stats without throwing.
- Collector failures should be logged rather than crashing the gateway.
- The registry should include both default process metrics and custom HTTP/queue metrics.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST expose a public Prometheus metrics endpoint that returns the current registry payload as text.
- **FR-002**: The gateway MUST record HTTP request duration and count metrics with method, path, and status labels.
- **FR-003**: The gateway MUST collect RabbitMQ queue depth and consumer-count gauges from the queue service.
- **FR-004**: The gateway MUST support configurable queue-metrics polling intervals.
- **FR-005**: The gateway MUST keep the metrics registry populated with default runtime metrics plus the custom HTTP and queue metrics.
- **FR-006**: The gateway MUST stop the queue metrics collector cleanly during module shutdown.

### Cross-Service Contracts

- **Producer**: API Gateway metrics controller and queue metrics collector
- **Consumer**: Prometheus scrapers and operators observing the gateway, plus the internal queue service that supplies stats
- **Payload shape**: Prometheus text output at `/metrics`, histogram and counter labels for HTTP requests, and queue gauges labeled by queue name
- **Compatibility rule**: Backward-compatible; preserve the current text endpoint, registry names, and metric labels
- **Validation rule**: Queue stats must come from the queue service and poll intervals must come from config or a default fallback

### Data / Schema Changes

- **Entity**: Prometheus registry entries and queue metric gauges
- **Attributes**: HTTP request duration histogram, HTTP request counter, queue messages gauge, queue consumers gauge
- **Ownership**: API Gateway observability stack
- **Migration impact**: None

### Operational Requirements

- **Security**: Keep the metrics endpoint public only as currently coded and do not expose sensitive payload data.
- **Observability**: Maintain Prometheus default metrics plus custom HTTP and queue measurements.
- **Failure behavior**: Serve metrics from the registry, return empty queue collection results gracefully when queue stats are unavailable, and log collector failures.
- **Config**: `QUEUE_METRICS_POLL_INTERVAL_MS` may tune collection frequency; otherwise the default interval applies.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `GET /metrics` returns Prometheus text with the expected content type and registry contents.
- **SC-002**: HTTP request recording updates both histogram and counter series with labeled values.
- **SC-003**: Queue metrics collection publishes queue depth and consumer counts into the registry.
- **SC-004**: Collector shutdown stops periodic polling without leaving an active interval behind.

## Assumptions

- The API Gateway remains the canonical source of runtime metrics for its own processes.
- Prometheus scraping is the primary consumer of the metrics endpoint.
- Queue stats are provided by the existing queue service rather than by direct broker access.
- Metrics are intentionally lightweight and do not change runtime business behavior.