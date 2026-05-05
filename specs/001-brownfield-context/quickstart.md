# Quickstart - Brownfield Context Completion

## Prerequisites

- Docker Compose for local infrastructure.
- Node.js and npm for the NestJS services.
- Java 17 and Maven for the CV Parser.

## Review The Runtime Truth

Start by reading the live code and config that define the current stack:

1. `api-gateway/package.json`
2. `api-gateway/prisma/schema.prisma`
3. `api-gateway/src/main.ts`
4. `cv-parser/pom.xml`
5. `cv-parser/src/main/java/com/talentflow/cvparser/CvParserApplication.java`
6. `notification/package.json`
7. `notification/src/main.ts`
8. `docker-compose.yml`

## Review The Historical Corpus

Use the archived legacy corpus as historical context and gap material only.

Recommended reading order:

1. Archived product requirements and architecture notes
2. Archived documentation inventory and distillation notes
3. Archived project context summary
4. Archived generation and validation reports

## Read The Generated Plan Artifacts

After the planning pass, the consolidated context lives under `specs/001-brownfield-context/`:

1. `specs/001-brownfield-context/plan.md`
2. `specs/001-brownfield-context/research.md`
3. `specs/001-brownfield-context/data-model.md`
4. `specs/001-brownfield-context/contracts/runtime-contracts.md`

## Optional Runtime Validation

If runtime code is changed later, validate with the narrowest service-specific command:

1. `cd api-gateway && npm run test`
2. `cd cv-parser && mvn test`
3. `cd notification && npm run test`

## Working Rule

Keep the runtime context grounded in the current repository snapshot. Legacy PRD claims should be documented only as gaps or historical notes, not promoted into the current state summary.