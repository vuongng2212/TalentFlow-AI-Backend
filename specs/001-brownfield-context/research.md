# Research - Brownfield Context Completion

## Decision 1: Runtime truth comes from current code and generated docs

Decision: Treat checked-in runtime code, schema files, bootstrap files, and generated docs as authoritative. Use the archived legacy corpus and older planning docs only as historical or gap context.

Rationale: The repository constitution and brownfield memory both require code/config truth to win over legacy documentation when they conflict.

Alternatives considered: Use the old PRD as the primary authority; merge old and new sources into a blended narrative.

## Decision 2: The deployed stack is polyglot and service-specific

Decision: Record the current stack as API Gateway on NestJS 11 and Prisma/PostgreSQL, CV Parser on Java 17 and Spring Boot 3.3, and Notification on NestJS 10 with Redis, RabbitMQ, Prisma, and Socket.IO foundations.

Rationale: The manifests, bootstrap files, compose file, and schema files confirm the runtime stack directly.

Alternatives considered: Collapse the stack into a single backend story; treat Notification as planned-only.

## Decision 3: Service maturity must be classified explicitly

Decision: Classify API Gateway as implemented, CV Parser as partial, and Notification as a scaffolded runtime shell with incomplete business flows.

Rationale: Current entrypoints and service wiring exist for all three parts, but only the gateway has the full HTTP-facing runtime role.

Alternatives considered: Mark Notification as planned-only; mark CV Parser as fully implemented because it boots.

## Decision 4: CV upload and parsing contracts use bucket plus fileKey

Decision: Document the CV upload event contract as `bucket` + `fileKey` based, with no `fileUrl` field, and keep RabbitMQ topology aligned to `talentflow.events`, `cv_parser.jobs`, and `cv_parser.jobs.dlq`.

Rationale: The source code explicitly warns against URL-based payloads and uses queue topology that matches the current runtime wiring.

Alternatives considered: Use a generic file URL payload; infer a new topology from the old PRD.

## Decision 5: Legacy PRD items remain historical notes only

Decision: Keep old PRD capabilities and future-scope statements in the gap/historical section instead of folding them into the current context summary.

Rationale: The user requirement for this feature is runtime-truth-only, and historical claims would blur the line between current state and intent.

Alternatives considered: Add a future-scope section alongside runtime truth; rewrite the old PRD into a current-state summary.