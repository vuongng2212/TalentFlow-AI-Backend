# TalentFlow AI Backend Documentation Index

**Type:** Spec Kit-aligned brownfield documentation index
**Primary language:** TypeScript and Java
**Architecture:** Polyglot microservice backend
**Last updated:** 2026-05-05

## Active documentation

### Spec Kit artifacts

- **[Brownfield Context Plan](../specs/001-brownfield-context/plan.md)** - Current planning artifact and technical context
- **[Research Notes](../specs/001-brownfield-context/research.md)** - Decisions captured from runtime truth and archive review
- **[Data Model](../specs/001-brownfield-context/data-model.md)** - Planning entities and validation rules
- **[Quickstart](../specs/001-brownfield-context/quickstart.md)** - Reading order for runtime truth and archived context
- **[Runtime Contracts](../specs/001-brownfield-context/contracts/runtime-contracts.md)** - HTTP, queue, and storage boundary snapshot

### Runtime references

- **API Gateway**: `api-gateway/src/main.ts`, `api-gateway/prisma/schema.prisma`
- **CV Parser**: `cv-parser/src/main/java/com/talentflow/cvparser/CvParserApplication.java`
- **Notification**: `notification/src/main.ts`
- **Infrastructure**: `docker-compose.yml`

## Archive

Historical brownfield materials are preserved in the repository archive for traceability only. They are not part of the active documentation set and should not be used as current authority.

## Reading order

1. Start with the Spec Kit artifacts under `specs/001-brownfield-context/`.
2. Use the runtime reference files only when you need implementation truth.
3. Consult the archive only for historical comparison or gap analysis.
