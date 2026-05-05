# Feature Specification: Brownfield Context Completion

**Feature Branch**: `002-brownfield-context`  
**Created**: 2026-05-04  
**Status**: Draft  
**Input**: User description: "Phân tích document của brownfield project @file:_bmad-output để hoàn thiện context của dự án"

## Clarifications

### Session 2026-05-05

- Q: Should the completed context stay runtime-truth-only, or include a separate planned/future-scope section for items from the old PRD? → A: Runtime-truth-only; record old PRD items only as gaps or historical notes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consolidate Project Context (Priority: P1)

As a maintainer or AI agent, I can read one consolidated project context summary that reflects the current repository truth, so I do not need to cross-check scattered brownfield documents.

**Why this priority**: This is the baseline value of the feature. Without a consolidated context, later planning and implementation work still depends on fragmented source documents.

**Independent Test**: A reviewer can answer the core questions about service roles, infrastructure, and repository scope using only the consolidated context.

**Acceptance Scenarios**:

1. **Given** the brownfield document set, **When** the context is compiled, **Then** the summary identifies the implemented, partial, and planning-only repository parts.
2. **Given** multiple source documents describe the same area differently, **When** the context is compiled, **Then** it reflects the current runtime truth and records the conflict.

---

### User Story 2 - Surface Gaps And Conflicts (Priority: P2)

As a planner, I can see gaps, outdated statements, and unresolved questions in the project context, so planning work starts from known constraints.

**Why this priority**: Planning quality depends on knowing what is missing or ambiguous before a new feature is defined.

**Independent Test**: A reviewer can identify the major contradictions and open questions without reading the raw source corpus.

**Acceptance Scenarios**:

1. **Given** a service is documented as runnable in one place but not supported by current runtime code, **When** the context is reviewed, **Then** the discrepancy is recorded as a gap.
2. **Given** a repository area has incomplete documentation, **When** the context is reviewed, **Then** the missing information is called out explicitly.

---

### User Story 3 - Provide Planning-Ready Reference (Priority: P3)

As a future feature planner, I can use the completed context as a launch point for specification and planning tasks, so I can prepare feature work faster.

**Why this priority**: This turns the context into a reusable project asset rather than a one-time analysis note.

**Independent Test**: A planner can start a planning exercise using the context without reopening the full source corpus for basic orientation.

**Acceptance Scenarios**:

1. **Given** a new feature request, **When** the completed context is referenced, **Then** the affected service boundaries and integration dependencies are already summarized.
2. **Given** a planning discussion begins, **When** the context is used, **Then** the major repository parts and their current maturity levels are immediately visible.

---

### Edge Cases

- Source documents conflict with current runtime code or configuration.
- A document refers to a service that exists only as planning material.
- Generated documentation disagrees with repository reality.
- A relevant document is missing, incomplete, or outdated.
- A shared contract is described differently across multiple source files.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST compile the project context from the brownfield document set and the current repository state.
- **FR-002**: The system MUST distinguish implemented, partial, and planning-only repository parts.
- **FR-003**: The system MUST summarize the primary service boundaries, infrastructure dependencies, and integration flows.
- **FR-004**: The system MUST record known conflicts, gaps, and assumptions explicitly.
- **FR-005**: The system MUST preserve traceability back to the source documents used to form the context.
- **FR-006**: When sources conflict, the system MUST prefer current runtime code and configuration over older planning documents.
- **FR-007**: The resulting context MUST stay focused on repository understanding and planning readiness rather than prescribing implementation work.
- **FR-008**: The system MUST treat legacy PRD items and other planning-only statements as historical context or open gaps, not as current runtime capability claims.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can identify the roles of the API Gateway, CV Parser, and Notification service from the completed context in under 10 minutes.
- **SC-002**: 100% of the documented repository parts are classified as implemented, partial, or planned.
- **SC-003**: All discovered conflicts or unknowns are listed as explicit assumptions or open questions.
- **SC-004**: At least 8 out of 10 standardized repository-orientation questions can be answered from the completed context without reopening the full source corpus.
- **SC-005**: A follow-up planning pass can proceed without requesting basic repository orientation from the maintainers.

## Assumptions

- Current runtime code and configuration are the source of truth when documentation conflicts arise.
- The brownfield document set in `_bmad-output` and the current repository snapshot are sufficient for context completion.
- No source-code changes or new runtime features are required to complete this feature.
- Planning-only services remain documented as such unless runtime code exists.
- Legacy PRD capabilities are included only when they help explain gaps or historical intent; they are not merged into the current runtime truth.
