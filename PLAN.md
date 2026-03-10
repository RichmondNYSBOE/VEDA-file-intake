# VoteVault Architecture Refactoring Plan

## Overview

Refactor from monolithic architecture to **Clean Architecture (Next.js-adapted)** with four layers: Domain, Services, Infrastructure, Content — plus presentation cleanup.

**Goal:** Business rules isolated and easy to change (legislative updates), user-facing text decoupled from components (instruction updates), security-sensitive code centralized for auditing.

---

## Phase 1: Domain Layer + Content Layer (PARALLEL)

These two have zero dependencies on each other and can run simultaneously.

### 1A. Domain Layer (`src/domain/`)

Extract pure business logic from `actions.ts` and components into framework-free TypeScript modules.

#### 1A-1. `src/domain/types.ts` — Consolidated type definitions
Move from `actions.ts`:
- `SubmissionLogEntry` (line 21)
- `FileVersionEntry` (line 33)
- `ElectionEventFileStatus` (line 48)
- `ElectionEvent` (line 57)
- `NoElectionsCertification` (line 69)
- `AttestationType` (line 614)
- `FileAttestation` (line 616)

Move from `election-types.ts`:
- `ElectionTypeOption` (line 6)
- `UploadStepFileType` (line 123)

Add re-exports from existing well-structured files:
- Re-export `FieldType`, `FieldSchema` from `file-schemas.ts`
- Re-export `ParsedData` from `file-parser.ts`
- Re-export `MatchConfidence`, `SchemaFieldMatch`, `MatchResult` from `header-matching.ts`

#### 1A-2. `src/domain/validation/rules.ts` — Validation business rules
Move from `actions.ts`:
- `validateType()` (line 804) — cell-level type validation
- `friendlyTypeName()` (line 780) — type label mapping
- `friendlyValue()` (line 796) — value formatting for errors
- Row validation logic from `performUpload()` (lines 890-960) — the loop that validates first 5 rows

This is where legislative changes to data requirements will land.

#### 1A-3. `src/domain/validation/schemas.ts` — Re-export existing schemas
- Re-export `fileSchemas` and `headerAliases` from `@/lib/file-schemas`
- Keep `file-schemas.ts` in place (it's already well-structured)
- The re-export creates a single import path for the domain layer

#### 1A-4. `src/domain/election/compliance.ts` — Compliance logic
Move from `dashboard.tsx`:
- `getComplianceStatus()` function (calculates upload progress per event)
- Compliance badge logic (determines status: complete, partial, not started)

#### 1A-5. `src/domain/election/attestation-rules.ts` — Attestation business rules
Extract from `actions.ts`:
- Attestation eligibility logic from `checkAttestationEligibility()` (lines 636-710)
- The business rules for when attestation is allowed (pure logic, no BigQuery)

#### 1A-6. `src/domain/election/naming.ts` — Election naming rules
Move from `election-types.ts`:
- `deriveElectionName()` (line 62)
- `getElectionTypesForAuthority()` (line 48)
- `ELECTION_TYPES_BY_CATEGORY` (line 14)
- `UPLOAD_STEPS` (line 84)

#### 1A-7. Update imports in all consumers
- `actions.ts` → import types and validation from `@/domain/`
- `upload-wizard.tsx` → import types from `@/domain/types`
- `dashboard.tsx` → import compliance logic from `@/domain/election/compliance`
- `create-election-dialog.tsx` → import naming from `@/domain/election/naming`
- All components importing `ElectionEvent`, etc. from `@/app/actions` → import from `@/domain/types`

### 1B. Content Layer (`src/content/`)

Extract all hardcoded user-facing strings from components.

#### 1B-1. `src/content/upload.ts` — Upload wizard text
Extract from `upload-wizard.tsx`:
- Step titles, descriptions, instructions
- File type labels and descriptions
- Error messages shown during upload/validation
- Drag-drop labels, paste instructions
- Amendment acknowledgment text
- Attestation descriptions

#### 1B-2. `src/content/dashboard.ts` — Dashboard text
Extract from `dashboard.tsx`:
- Section headings, empty states
- Compliance status labels
- Election event card text
- Certification card text

#### 1B-3. `src/content/validation-messages.ts` — Validation error messages
Extract from `actions.ts`:
- Type mismatch error messages (lines 920-940)
- File size/format error messages
- Schema validation error messages
- Upload success/failure messages

#### 1B-4. `src/content/elections.ts` — Election-related text
Extract from `create-election-dialog.tsx`, `no-elections-dialog.tsx`:
- Form labels, placeholders, help text
- Dialog titles and descriptions
- Certification text

#### 1B-5. `src/content/common.ts` — Shared text
- Button labels (Upload, Cancel, Confirm, Back, etc.)
- Common status labels
- App-wide terminology

#### 1B-6. Update component imports
- Each component imports its text from the corresponding content file
- Components use content constants instead of inline strings

---

## Phase 2: Service Layer + Infrastructure Layer (PARALLEL, after Phase 1)

### 2A. Service Layer (`src/services/`)

Orchestration layer — calls domain logic + infrastructure, called by server actions.

#### 2A-1. `src/services/upload-service.ts`
Extract from `actions.ts`:
- `performUpload()` logic (lines 844-1054) → orchestrates validation + GCS upload + logging
- Uses domain validation rules (from Phase 1)
- Calls infrastructure for GCS storage and BigQuery logging

#### 2A-2. `src/services/election-service.ts`
Extract from `actions.ts`:
- `createElectionEvent()` logic (lines 332-391)
- `getElectionEvents()` logic (lines 393-420)
- `getElectionEvent()` logic (lines 422-447)
- `deleteElectionEvent()` logic (lines 496-536)
- `updateElectionEventFileStatus()` logic (lines 449-494)

#### 2A-3. `src/services/audit-service.ts`
Extract from `actions.ts`:
- `logSubmission()` logic (lines 91-116)
- `getSubmissionLogs()` logic (lines 118-216)
- `createFileVersion()` logic (lines 155-216)
- `getFileVersions()` / `getAllFileVersions()` logic (lines 218-330)

#### 2A-4. `src/services/attestation-service.ts`
Extract from `actions.ts`:
- `checkAttestationEligibility()` (lines 636-710) — calls domain rules + BigQuery
- `submitAttestation()` (lines 712-773) — orchestrates attestation submission

#### 2A-5. `src/services/certification-service.ts`
Extract from `actions.ts`:
- `certifyNoElections()` logic (lines 538-582)
- `getNoElectionsCertifications()` logic (lines 584-612)

### 2B. Infrastructure Layer (`src/infrastructure/`)

Data access — all BigQuery SQL and GCS operations centralized here.

#### 2B-1. `src/infrastructure/bigquery/client.ts`
- Move `bq` client and `DATASET` from `bigquery.ts`
- Move `ensureSchema()` from `bigquery.ts`
- Keep as singleton with lazy initialization

#### 2B-2. `src/infrastructure/bigquery/election-repository.ts`
Extract BigQuery queries from `actions.ts` related to elections:
- Insert/select/delete election events
- Update file status within election events
- All election-related SQL centralized here

#### 2B-3. `src/infrastructure/bigquery/submission-repository.ts`
Extract BigQuery queries from `actions.ts` related to submissions:
- Insert/select submission logs
- Insert/select file versions
- All audit-related SQL centralized here

#### 2B-4. `src/infrastructure/bigquery/attestation-repository.ts`
Extract BigQuery queries for attestations:
- Check existing attestations
- Insert new attestations

#### 2B-5. `src/infrastructure/bigquery/certification-repository.ts`
Extract BigQuery queries for certifications:
- Insert/select no-elections certifications

#### 2B-6. `src/infrastructure/storage/gcs-client.ts`
Extract from `actions.ts`:
- GCS bucket initialization
- `uploadToGCS()` function (file upload logic)
- File path construction logic

#### 2B-7. Thin `src/app/actions.ts`
Rewrite as thin routing layer (~100-150 lines):
- Each server action becomes 3-5 lines: validate input → call service → return result
- All "use server" directives stay here
- Error handling wrapper for each action

---

## Phase 3: Component Cleanup (after Phase 2)

### 3A. Split Upload Wizard
Break `upload-wizard.tsx` (1,241 lines) into:

#### 3A-1. `src/components/upload/wizard-container.tsx` (~150 lines)
- Step navigation state and progress bar
- Renders current step component
- Manages overall wizard flow

#### 3A-2. `src/components/upload/file-selection-step.tsx` (~200 lines)
- Drag-drop zone, file picker, paste input
- File parsing (calls `parseFile`, `parseTabDelimited`)
- Imports text from `@/content/upload`

#### 3A-3. `src/components/upload/header-matching-step.tsx` (~150 lines)
- Header analysis display
- Opens FieldMappingModal for corrections
- Shows match confidence indicators

#### 3A-4. `src/components/upload/preview-step.tsx` (~100 lines)
- DataPreview component integration
- Row count, column count display

#### 3A-5. `src/components/upload/confirmation-step.tsx` (~150 lines)
- Amendment acknowledgment
- Attestation options
- Final upload trigger (calls upload service via server action)

### 3B. Split Dashboard
Break `dashboard.tsx` (625 lines) into:

#### 3B-1. Keep `src/components/dashboard/dashboard.tsx` (~200 lines)
- Layout shell, view routing (dashboard/wizard/history)
- Data fetching orchestration

#### 3B-2. `src/components/dashboard/election-event-card.tsx` (~150 lines)
- Individual event card with file status dots
- Upload button, delete button

#### 3B-3. `src/components/dashboard/compliance-badge.tsx` (~50 lines)
- Uses compliance logic from `@/domain/election/compliance`

#### 3B-4. `src/components/dashboard/certification-card.tsx` (~80 lines)
- No-elections certification display

### 3C. Remove Dead Code

#### 3C-1. Evaluate `file-upload-card.tsx` (562 lines)
- Confirm it's superseded by UploadWizard
- If no routes reference it, remove it
- If `upload-dashboard.tsx` uses it, evaluate if upload-dashboard is also dead

#### 3C-2. Evaluate `upload-dashboard.tsx`
- Legacy upload interface — confirm whether it's still routed to
- If dead, remove along with `file-upload-card.tsx`

#### 3C-3. Evaluate `src/lib/firestore.ts` (17 lines)
- Only exports a client with no functions
- If unused, remove. If planned for future, add a TODO comment.

#### 3C-4. Remove hardcoded user identity
- `actions.ts` line 79: `const CURRENT_USER = "Ryan Richmond"`
- Replace with proper auth context or parameter

---

## Execution Strategy

```
Phase 1A (Domain) ──────┐
                         ├──→ Phase 2A (Services) ──────┐
Phase 1B (Content) ─────┘    Phase 2B (Infrastructure) ─┤
                                                         ├──→ Phase 3 (Components)
                                                         │
                                                         └──→ Phase 3C (Dead Code)
```

- **Phase 1:** Two parallel subagents — one for Domain, one for Content
- **Phase 2:** Two parallel subagents — one for Services, one for Infrastructure. Then thin `actions.ts` (depends on both).
- **Phase 3:** Component splits + dead code removal (serial, as each affects the other)

### Verification After Each Phase

After each phase:
1. `npm run build` must pass
2. All existing imports must resolve (no broken references)
3. No functionality changes — pure refactoring
4. Commit with descriptive message

### Risk Mitigation

- **No behavioral changes** — this is a structural refactoring only
- Each phase produces a working build before the next begins
- Types are moved first (Phase 1A) so all subsequent phases have a stable type foundation
- Content extraction (Phase 1B) is purely additive until components are updated
- Old files get re-export shims during transition, removed in final cleanup
