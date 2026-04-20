---
type: bmad-distillate
sources:
  - '../docs/architecture-api-gateway.md'
  - '../docs/architecture-cv-parser.md'
  - '../docs/architecture-notification.md'
  - '../docs/api-contracts-api-gateway.md'
  - '../docs/data-models-api-gateway.md'
  - '../docs/data-models-cv-parser.md'
  - '../docs/development-guide-api-gateway.md'
  - '../docs/development-guide-cv-parser.md'
  - '../docs/development-guide-notification.md'
  - '../docs/index.md'
  - '../docs/integration-architecture.md'
  - '../docs/project-overview.md'
  - '../docs/project-parts.json'
  - '../docs/project-scan-report.json'
  - '../docs/source-tree-analysis.md'
downstream_consumer: general
created: 2026-04-18
token_estimate: 9969
parts: 8
---

## Orientation
- This folder is a split BMAD distillate of the generated `docs/` set.
- The content preserves the repository identity, source tree, integration contracts, service-specific architecture, service-specific development guidance, service data models, and the generated metadata state.
- Use the section files independently when a narrower context window is better, or load `_index.md` first when you want the full map.
- The distillate is organized so the cross-cutting facts sit alongside the service-specific facts they support.

## Section manifest
- **[01-repository-and-docs.md](./01-repository-and-docs.md)** - Repo facts, docs inventory, and source tree context
- **[02-documentation-inventory.md](./02-documentation-inventory.md)** - BMAD document map and generated-doc summary
- **[03-repository-layout-and-source-tree.md](./03-repository-layout-and-source-tree.md)** - Directory layout, entry points, and file patterns
- **[04-cross-service-integration.md](./04-cross-service-integration.md)** - Runtime topology, events, storage, and risks
- **[05-api-gateway.md](./05-api-gateway.md)** - Gateway runtime, contracts, data model, and setup
- **[06-cv-parser.md](./06-cv-parser.md)** - Worker pipeline, contracts, data model, and setup
- **[07-notification.md](./07-notification.md)** - Planned service scope and constraints
- **[08-project-metadata-and-generation-state.md](./08-project-metadata-and-generation-state.md)** - Part inventory and scan-report metadata

## Cross-cutting items
- The repository is a three-part monorepo with API Gateway implemented, CV Parser partial, and Notification planned only.
- The API Gateway is the canonical HTTP surface and uses `/api/v1` for all application routes except `health`, `ready`, and `metrics`.
- The main event path is `cv.uploaded` from API Gateway to CV Parser, followed by `cv.parsed` or `cv.failed` downstream.
- Object storage references must use `bucket + fileKey`; arbitrary upload URLs are intentionally not the contract.
- The repository’s doc set is generated from runtime code and configuration first, and the current docs are intended to be the single source of truth.
- The generation report says the initial scan is complete and the output set is stable until a post-generation update is needed.
