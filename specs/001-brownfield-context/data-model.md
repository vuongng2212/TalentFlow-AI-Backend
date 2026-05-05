# Data Model - Brownfield Context Completion

This feature models the planning artifacts that describe the repository, not the ATS domain itself.

## Entities

### SourceArtifact

Fields:
- `path`: canonical repository-relative path to the source document or runtime file
- `kind`: `legacy-doc`, `runtime-code`, `generated-doc`, or `infrastructure-config`
- `serviceScope`: `api-gateway`, `cv-parser`, `notification`, `shared-infra`, or `repo-wide`
- `trustLevel`: `authoritative`, `supporting`, or `historical`
- `summary`: short evidence note used in the context write-up

Relationships:
- One `SourceArtifact` can support many `ServiceProfile`, `ConflictRecord`, and `GapRecord` entries.

Validation rules:
- Every source artifact must have a non-empty path and a valid trust level.
- Runtime-code and infrastructure-config artifacts outrank legacy-doc artifacts when they disagree.

### ServiceProfile

Fields:
- `name`: service name
- `maturity`: `implemented`, `partial`, or `scaffolded`
- `languageStack`: concise runtime stack summary
- `entrypoint`: primary bootstrap file or main entrypoint
- `responsibilities`: short list of current runtime responsibilities

Relationships:
- A service profile references many `SourceArtifact` records.
- A service profile can own many `ContractSurface` records.

Validation rules:
- Each service profile must have exactly one maturity value.
- Maturity must match runtime evidence, not old PRD language.

### ContractSurface

Fields:
- `name`: contract name such as HTTP API, RabbitMQ event, or object-storage upload contract
- `protocol`: `http`, `amqp`, or `s3`
- `producer`: owning service or system
- `consumer`: consuming service or system
- `payloadRules`: required payload constraints and security rules

Relationships:
- A contract surface is backed by one or more `SourceArtifact` records.
- A contract surface can be referenced by multiple gap or conflict records.

Validation rules:
- CV upload contracts must require `bucket` and `fileKey`.
- Upload contracts must not rely on arbitrary file URLs.

### ConflictRecord

Fields:
- `claim`: the legacy statement or mismatch being captured
- `runtimeTruth`: the current code/config fact that resolves the claim
- `resolution`: how the discrepancy should be documented
- `severity`: `low`, `medium`, or `high`

Relationships:
- Each conflict record must reference at least one legacy source and one runtime source.

Validation rules:
- Conflicts cannot be silently merged into the summary.
- A conflict must end in an explicit resolution or remain open as a gap.

### GapRecord

Fields:
- `description`: missing, incomplete, or outdated information
- `impact`: why the gap matters for planning or orientation
- `followUp`: next action or question to resolve later

Relationships:
- A gap record may be linked to one or more `SourceArtifact` records.

Validation rules:
- Gaps must stay separate from confirmed runtime facts.

### Assumption

Fields:
- `statement`: explicit assumption used to bridge missing information
- `confidence`: `high`, `medium`, or `low`
- `sourceRefs`: supporting source links

Relationships:
- Assumptions may be promoted to facts later if runtime evidence appears.

Validation rules:
- Every assumption must be labeled as an assumption.
- Do not use assumptions to override source-backed runtime evidence.

## State Notes

- Source artifacts are immutable once captured for this planning pass.
- Conflict and gap records should be reopened only if new runtime evidence changes the truth.
- Service maturity can move from `scaffolded` to `partial` or `implemented` only when runtime code proves the transition.