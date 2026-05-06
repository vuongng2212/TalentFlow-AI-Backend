# TalentFlow AI Backend - Project Maturity and Feature Roadmap

**Date:** 2026-05-06
**Assessment basis:** runtime code, active specs, package manifests, and the brownfield constitution in [../.specify/memory/constitution.md](../.specify/memory/constitution.md)

## Method

This assessment follows the constitution rule that runtime code is the source of truth. Frozen legacy sources are treated as reference only. The roadmap below is ranked by a simple order of value:

1. Features that unblock a real runtime contract or persistence path.
2. Features that make an existing runtime path correct and safe.
3. Features that improve supportability, auditability, or developer confidence.

## Maturity Assessment

| Area               | Maturity         | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overall repository | Mixed brownfield | The repo has one strong HTTP gateway, one partially implemented worker, and one scaffold notification service.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| API Gateway        | Mature           | The gateway has a broad NestJS/Prisma runtime, tests, queue/storage integrations, and many feature modules already in place. See [../api-gateway/package.json](../api-gateway/package.json), [../api-gateway/prisma/schema.prisma](../api-gateway/prisma/schema.prisma), and [../api-gateway/test/app.e2e-spec.ts](../api-gateway/test/app.e2e-spec.ts).                                                                                                                                                                                       |
| CV Parser          | Partial          | The worker boots as a real Spring Boot service, but persistence and contract enforcement are still incomplete. See [../cv-parser/pom.xml](../cv-parser/pom.xml), [../cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java](../cv-parser/src/main/java/com/talentflow/cvparser/listener/CvParserListener.java), and [../cv-parser/src/main/java/com/talentflow/cvparser/repository/NoOpCvParseResultRepository.java](../cv-parser/src/main/java/com/talentflow/cvparser/repository/NoOpCvParseResultRepository.java). |
| Notification       | Scaffold         | The service has email and runtime scaffolding, but the real delivery pipeline is not implemented yet. See [../notification/package.json](../notification/package.json), [../notification/src/email/email.service.ts](../notification/src/email/email.service.ts), [../notification/src/rabbitmq/notification.consumer.ts](../notification/src/rabbitmq/notification.consumer.ts), and [../notification/src/notification/notification.gateway.ts](../notification/src/notification/notification.gateway.ts).                                    |

## What The Constitution Implies

- The repository is not a greenfield project; it is a mixed-maturity brownfield system.
- The API Gateway is the most complete runtime surface and should stay the default anchor for cross-service work.
- The CV Parser must be treated as a queue-driven worker, not an HTTP service.
- Notification should not be described as feature-complete until its delivery path and persistence actually exist in code.

## Prioritized Feature Roadmap

| Priority | Feature                                      | Service      | Why it is high priority                                                                                                                                                    |
| -------- | -------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Real notification delivery pipeline          | Notification | The consumer and gateway are still placeholders, so the service does not yet deliver notifications end to end. This is a core product capability, not a nice-to-have.      |
| P1       | Persistent notification history              | Notification | The service currently synthesizes notification responses instead of reading durable records. Users need a real history and lookup path.                                    |
| P1       | Durable CV parse result persistence          | CV Parser    | The worker parses files, but the repository is still a no-op. Parsed output must become durable before downstream features can rely on it.                                 |
| P2       | Parser queue-contract enforcement            | CV Parser    | The constitution requires `bucket` plus `fileKey` contract discipline. Payload validation and storage resolution need to match that rule exactly.                          |
| P2       | Workspace billing or subscription state      | API Gateway  | The workspaces service still uses a temporary proxy for business access. That is a real business gap because entitlement is being inferred rather than owned.              |
| P2       | Useful CV scoring signal                     | CV Parser    | The parser currently emits a placeholder score. A meaningful score is needed for ranking, triage, and downstream automation.                                               |
| P3       | Destructive-flow audit and restore semantics | API Gateway  | Some deletion and cancellation flows still lean on hard delete or status-only behavior. That is acceptable for shipping, but it weakens auditability and support recovery. |
| P3       | Full-runtime gateway e2e hardening           | API Gateway  | The gateway is already the strongest service, so the next gain is confidence: broader end-to-end coverage for the highest-value flows.                                     |

## Suggested Reading Order For Implementation

If the team wants the shortest path to a more complete product, the practical order is:

1. Finish the notification delivery path and storage model.
2. Make CV parsing durable and contract-safe.
3. Remove temporary proxies in the gateway that hide unfinished business logic.
4. Add hardening work after the runtime paths are real.

## Notes And Caveats

- The generated brownfield documentation still contains one stale item: [../docs/source-tree-analysis.md](../docs/source-tree-analysis.md) mentions an `archive/` directory, but the current repository root does not contain one.
- This roadmap intentionally favors runtime truth over older planning narratives.
- The list above is prioritized by current architectural leverage, not by feature count or file count.

## Resulting Project Shape

The most accurate short description of the repository today is:

> A mature API Gateway, a partially implemented CV parsing worker, and a scaffold Notification service that still needs real delivery and persistence.
