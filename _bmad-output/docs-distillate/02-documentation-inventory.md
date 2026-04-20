This section covers Documentation inventory. Part 2 of 8.

## Documentation inventory
- Core documentation:
  - `project-overview.md` gives the executive summary, part classification, feature list, architecture highlights, and getting started snapshot.
  - `source-tree-analysis.md` describes repo layout, entry points, file patterns, and development notes.
  - `integration-architecture.md` describes service boundaries, broker contract, data flow, storage flow, and integration risks.
  - `index.md` is the human-facing docs map and quick reference for the BMAD-generated docs set.
- API Gateway documentation:
  - `architecture-api-gateway.md` describes the gateway runtime, module layout, security model, integrations, and operational endpoints.
  - `development-guide-api-gateway.md` covers local setup, commands, environment variables, local URLs, and verification.
  - `api-contracts-api-gateway.md` enumerates the gateway routes, auth behavior, and response conventions.
  - `data-models-api-gateway.md` documents the Prisma-backed ATS models and their relationships.
- CV Parser documentation:
  - `architecture-cv-parser.md` describes the worker pipeline, message topology, parser responsibilities, and operational surface.
  - `development-guide-cv-parser.md` covers local setup, Maven commands, runtime config, and verification.
  - `data-models-cv-parser.md` documents inbound/outbound queue DTOs, extracted profile shapes, and the lack of finalized durable persistence.
- Notification documentation:
  - `architecture-notification.md` captures the planned service scope, planned integrations, and the warning that it is not runnable yet.
  - `development-guide-notification.md` captures the future-service workflow and setup notes.
- Workflow metadata:
  - `project-parts.json` is the machine-readable inventory of the three parts and their integration settings.
  - `project-scan-report.json` records the generated-doc workflow status, completed steps, and validation metadata.
