# Architecture Refactor — Clean Architecture for VoteVault

**Date:** 2026-03-10
**Branch:** `claude/review-architecture-U9bBs`
**Scope:** Full decomposition of monolithic `actions.ts` into layered architecture

---

## Motivation

The application's server-side logic lived entirely in a single 930-line file (`src/app/actions.ts`). This file contained type definitions, input validation schemas, BigQuery queries, GCS operations, business rules, audit logging, and user-facing error messages — all interleaved. This made the code difficult to test, navigate, and extend.

The refactor introduces a Clean Architecture with four new layers, each with a single responsibility and a strict dependency direction.

---

## Architecture Overview

```
┌──────────────────────────────────┐
│        app/actions.ts            │  Thin routing — extracts params, delegates
│        (server actions)          │  to services, re-exports types
└──────────────┬───────────────────┘
               │ delegates to
┌──────────────▼───────────────────┐
│          services/*              │  Orchestrates domain rules + infrastructure
│  (upload, election, audit,       │  Returns structured results (never throws)
│   attestation, certification)    │
└───┬──────────┬───────────┬───────┘
    │          │           │
    ▼          ▼           ▼
┌────────┐ ┌────────┐ ┌──────────────┐
│domain/*│ │content/│ │infrastructure/│
│ types, │ │strings,│ │ repositories, │
│ rules  │ │messages│ │ storage       │
└────────┘ └────────┘ └──────────────┘
```

**Dependency rules:**

- `services/` may import from `domain/`, `content/`, and `infrastructure/`
- `infrastructure/` may import from `domain/` (types only)
- `domain/` imports nothing from services or infrastructure
- `content/` imports nothing from other layers
- Components import from `app/actions` and `content/`, never directly from services or infrastructure

---

## New Directory Structure

```
src/
├── domain/                              # Pure business logic & types
│   ├── types.ts                         # Canonical type definitions
│   ├── validation/
│   │   └── rules.ts                     # CSV validation (pure functions)
│   └── election/
│       ├── naming.ts                    # Election naming utilities
│       ├── attestation-rules.ts         # Attestation eligibility rules
│       └── compliance.ts               # Election compliance status
│
├── content/                             # User-facing strings
│   ├── common.ts                        # Shared labels, status terms
│   ├── upload.ts                        # Upload wizard strings
│   ├── validation-messages.ts           # Validation error messages
│   ├── elections.ts                     # Election dialog strings
│   └── dashboard.ts                     # Dashboard UI strings
│
├── services/                            # Business orchestration
│   ├── upload-service.ts                # File upload lifecycle
│   ├── election-service.ts              # Election CRUD
│   ├── audit-service.ts                 # Submission logs & file versioning
│   ├── attestation-service.ts           # Attestation eligibility & submission
│   └── certification-service.ts         # No-elections certification
│
├── infrastructure/                      # Data access & external services
│   ├── bigquery/
│   │   ├── client.ts                    # Singleton client, shared constants
│   │   ├── election-repository.ts       # election_events table
│   │   ├── submission-repository.ts     # submission_logs & file_versions
│   │   ├── attestation-repository.ts    # file_attestations table
│   │   └── certification-repository.ts  # no_elections_certifications table
│   └── storage/
│       └── gcs-client.ts               # Google Cloud Storage operations
```

---

## Layer Details

### Domain (`src/domain/`)

Pure business logic with zero infrastructure dependencies.

| File | Purpose |
|------|---------|
| `types.ts` | Canonical type definitions (`ElectionEvent`, `SubmissionLogEntry`, `FileVersionEntry`, `AttestationType`, etc.). Single source of truth — all other layers import from here. |
| `validation/rules.ts` | `validateCsvRows()` and `validateType()` — pure functions that validate CSV data against schemas. No side effects. |
| `election/attestation-rules.ts` | `getAvailableAttestationTypes()`, `isAlwaysEligible()` — determines which attestation options apply to each file type. |
| `election/compliance.ts` | `getComplianceStatus()` — derives `"complete"`, `"in-progress"`, or `"not-started"` from an election event's file statuses. |
| `election/naming.ts` | Re-exports `deriveElectionName()` and election type constants for domain-level access. |

### Content (`src/content/`)

All user-facing strings, centralized for consistency and future localization.

| File | Purpose |
|------|---------|
| `common.ts` | Shared button labels (`Cancel`, `Back`, `Upload`), status terms, app name |
| `upload.ts` | Upload wizard step labels, file selection prompts, attestation dialog text |
| `validation-messages.ts` | Error messages for file size, column mismatch, row validation, type errors |
| `elections.ts` | Dialog strings for creating/deleting elections, no-elections certification |
| `dashboard.ts` | Page headings, empty states, file status legend, sidebar content |

**Pattern:** All strings are exported as `const` objects with nested structure, using `as const` for type safety.

### Services (`src/services/`)

Business orchestration — coordinates domain rules, content, and infrastructure. Every service function catches errors internally and returns a structured `{ success, message }` result. Services never throw.

| File | Responsibility |
|------|---------------|
| `upload-service.ts` | Full upload lifecycle: validate CSV/shapefile → upload to GCS → log submission → create file version → update election event status |
| `election-service.ts` | Election CRUD: duplicate checks, default file status initialization, cascading deletes (deactivate related file versions) |
| `audit-service.ts` | Submission log inserts (fire-and-forget), file version creation with auto-deactivation of prior versions |
| `attestation-service.ts` | Eligibility checks (domain rules + infrastructure queries), attestation recording, election event status updates |
| `certification-service.ts` | No-elections certification with duplicate detection |

### Infrastructure (`src/infrastructure/`)

Data access with no business logic. Each repository maps to a BigQuery table and exposes simple CRUD operations.

| File | Table(s) |
|------|----------|
| `bigquery/client.ts` | Shared client, constants (`CURRENT_USER`, `FILE_TYPES`, `DEFAULT_FILE_STATUS`), type conversion helpers |
| `bigquery/election-repository.ts` | `election_events` — find, insert, fetch, update files, delete |
| `bigquery/submission-repository.ts` | `submission_logs`, `file_versions` — insert, fetch, deactivate |
| `bigquery/attestation-repository.ts` | `file_attestations` — eligibility queries, insert |
| `bigquery/certification-repository.ts` | `no_elections_certifications` — find, insert, fetch |
| `storage/gcs-client.ts` | Google Cloud Storage — upload buffer with metadata |

### App Actions (`src/app/actions.ts`)

Reduced from ~930 lines to ~130 lines. Now a thin routing layer that:

1. Extracts parameters from function arguments or `FormData`
2. Delegates to the appropriate service
3. Returns the result

It also re-exports domain types so existing component imports (`from '@/app/actions'`) continue to work without modification.

---

## What Moved Where

| What | From | To |
|------|------|----|
| Type definitions (`ElectionEvent`, `SubmissionLogEntry`, etc.) | `actions.ts` (inline) | `domain/types.ts` |
| CSV validation logic (`validateCsvRows`, `validateType`) | `actions.ts` (inline) | `domain/validation/rules.ts` |
| Attestation eligibility rules | `actions.ts` (inline) | `domain/election/attestation-rules.ts` |
| Compliance status calculation | `actions.ts` (inline) | `domain/election/compliance.ts` |
| User-facing strings | `actions.ts` + scattered across components | `content/*.ts` |
| Upload orchestration (`performUpload`, shapefile handling) | `actions.ts` | `services/upload-service.ts` |
| Election CRUD logic | `actions.ts` | `services/election-service.ts` |
| Audit logging & file versioning | `actions.ts` | `services/audit-service.ts` |
| Attestation submission logic | `actions.ts` | `services/attestation-service.ts` |
| Certification logic | `actions.ts` | `services/certification-service.ts` |
| BigQuery queries (inline SQL) | `actions.ts` | `infrastructure/bigquery/*.ts` |
| GCS upload operations | `actions.ts` | `infrastructure/storage/gcs-client.ts` |
| Input validation schemas (Zod) | `actions.ts` | Preserved in respective service files |

---

## Error Handling Pattern

All service functions follow a consistent pattern:

```typescript
export async function someOperation(params: Input): Promise<{ success: boolean; message: string }> {
  try {
    await ensureSchema();
    // ... business logic + repository calls ...
    return { success: true, message: validationMessages.someSuccess };
  } catch (error) {
    console.error('Failed to ...:', error);
    return { success: false, message: validationMessages.someError };
  }
}
```

Error messages shown to users come from the content layer. Internal error details are logged server-side only.

---

## Benefits

1. **Testability** — Domain logic and services can be unit tested without mocking BigQuery or GCS. Infrastructure repositories can be tested in isolation.

2. **Navigability** — Finding where election creation logic lives means looking in `services/election-service.ts`, not scanning a 930-line file. Each file has a single, clear purpose.

3. **Localization readiness** — All user-facing strings are centralized in `content/`. Swapping to a different locale or i18n framework requires changes in one place.

4. **Separation of concerns** — Business rules (domain), data access (infrastructure), orchestration (services), and presentation text (content) are cleanly separated. Changes to one layer rarely require changes to another.

5. **Consistent error handling** — Services always return structured results. No uncaught exceptions propagate to the client.

6. **Infrastructure swappability** — The repository pattern means switching from BigQuery to Firestore (or any other store) requires changes only in `infrastructure/`, with no impact on services or domain logic.

---

## Migration Notes

- **No breaking changes to components.** All component imports from `@/app/actions` continue to work — types are re-exported, function signatures are unchanged.
- **Build verified.** The production build (`npm run build`) passes with no errors after the refactor.
- **Existing `src/lib/` files are untouched.** Utility modules (`file-schemas.ts`, `file-parser.ts`, `bigquery.ts`, etc.) remain in place. The new layers import from them where needed.
