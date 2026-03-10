# CLAUDE.md — Project Context for Claude Code

## Project Overview

**VoteVault** — A secure web platform for uploading and validating election-related CSV data (Election Results, Elections, Voter History, Poll Sites). Data is validated against strict schemas and stored in Google Cloud Storage.

## Build & Run Commands

```bash
npm install --legacy-peer-deps   # MUST use --legacy-peer-deps
npm run dev                      # Start dev server
npm run build                    # Production build
npm run lint                     # Run ESLint
```

- Node.js 20+ required
- Docker build: `docker build -t votevault .` (multi-stage, Alpine)

## Architecture

The codebase follows a Clean Architecture with four layers. See `docs/architecture-refactor.md` for the full rationale.

```
src/
  app/
    page.tsx              # Main page — NYS banner, dashboard, election selector
    layout.tsx            # Root layout, metadata, Inter font, Toaster provider
    actions.ts            # Thin routing layer — delegates to services, re-exports types
    globals.css           # CSS variables, theme tokens (light/dark)
  domain/                 # Pure business logic & types (NO infrastructure deps)
    types.ts              # Canonical type definitions (single source of truth)
    validation/
      rules.ts            # CSV validation — pure functions, no side effects
    election/
      naming.ts           # Election naming utilities
      attestation-rules.ts # Attestation eligibility rules
      compliance.ts       # Election compliance status calculation
  content/                # User-facing strings (localization-ready)
    common.ts             # Shared labels, status terms, app name
    upload.ts             # Upload wizard strings
    validation-messages.ts # Validation error messages
    elections.ts          # Election dialog strings
    dashboard.ts          # Dashboard UI strings
  services/               # Business orchestration (coordinates domain + infrastructure)
    upload-service.ts     # File upload lifecycle (validate → store → audit → version)
    election-service.ts   # Election CRUD
    audit-service.ts      # Submission logs & file versioning
    attestation-service.ts # Attestation eligibility & submission
    certification-service.ts # No-elections certification
  infrastructure/         # Data access & external services (NO business logic)
    bigquery/
      client.ts           # Singleton client, shared constants, helpers
      election-repository.ts    # election_events table
      submission-repository.ts  # submission_logs & file_versions tables
      attestation-repository.ts # file_attestations table
      certification-repository.ts # no_elections_certifications table
    storage/
      gcs-client.ts       # Google Cloud Storage operations
  components/
    dashboard.tsx             # Main dashboard UI
    upload-wizard.tsx         # Primary upload interface (step-by-step)
    file-upload-card.tsx      # Drag-and-drop file upload component
    upload-dashboard.tsx      # Upload dashboard view
    upload-history.tsx        # Upload history / submission log
    data-preview.tsx          # CSV data preview table
    field-mapping-modal.tsx   # Column mapping modal
    submission-log.tsx        # Audit trail for submissions
    nys-banner.tsx            # NYS official branding banner
    election-authority-context.tsx   # Election authority React context
    election-authority-selector.tsx  # Authority selector dropdown
    create-election-dialog.tsx      # Create election event dialog
    delete-election-dialog.tsx      # Delete election confirmation
    no-elections-dialog.tsx         # No-elections certification dialog
    version-history-dialog.tsx      # File version history viewer
    info-sidebar.tsx          # Information sidebar
    upload-progress-bar.tsx   # Upload progress indicator
    icons.tsx                 # Custom VoteVault icon
    ui/                       # shadcn/ui component library (26+ components)
  hooks/
    use-toast.ts          # Toast notification hook
    use-mobile.tsx        # Mobile detection hook
  lib/
    file-schemas.ts       # Zod schemas for all 4 CSV file types
    file-parser.ts        # CSV parsing utilities
    header-matching.ts    # Fuzzy column header matching / normalization
    election-types.ts     # Election data TypeScript types
    bigquery.ts           # BigQuery client and auto-schema provisioning
    firestore.ts          # Firestore database operations
    shapefile-converter.ts # Shapefile → GeoJSON conversion
    utils.ts              # cn() classname merge utility
  types/
    shapefile.d.ts        # TypeScript declarations for shapefile lib
infra/
  malware-scanner/        # ClamAV-based malware scanning service (Cloud Run)
  terraform/              # Infrastructure as Code (GCP resources)
docs/
  blueprint.md            # Design guidelines, color palette, typography
  security-audit.md       # Security audit findings and recommendations
  architecture-refactor.md # Architecture refactor documentation
```

### Layered Architecture

```
  app/actions.ts  →  services/*  →  domain/* + content/* + infrastructure/*
  (thin routing)     (orchestration)  (pure logic)  (strings)   (data access)
```

**Dependency rules:**
- `services/` may import from `domain/`, `content/`, and `infrastructure/`
- `infrastructure/` may import from `domain/` (types only)
- `domain/` and `content/` have no upstream dependencies
- Components import from `app/actions` and `content/`, never directly from services or infrastructure

### Key Patterns

- **Server actions** (`"use server"`) in `actions.ts` are a thin routing layer — they extract parameters and delegate to service functions
- **Services** orchestrate business logic, catch all errors, and return structured `{ success, message }` results (never throw)
- **Domain** contains pure functions and type definitions with zero infrastructure dependencies
- **Content** centralizes all user-facing strings for consistency and localization readiness
- **Infrastructure** implements the repository pattern — one repository per BigQuery table
- **Client components** (`"use client"`) only for interactive UI (forms, drag-and-drop)
- **Zod + React Hook Form** for all form/data validation
- **shadcn/ui** as the component library — do not introduce alternative UI libraries
- CSV validation defined in `src/lib/file-schemas.ts` with strict column schemas per file type

## Code Style & Conventions

### TypeScript

- Strict mode enabled — never use `any` without justification
- Use explicit type annotations for function parameters and return types
- Use interfaces for component props, types for unions/utility types
- Path alias: `@/*` maps to `./src/*` — always use it instead of relative paths

### Naming

- **Components:** PascalCase (`FileUploadCard`, `VoteVaultIcon`)
- **Functions/variables:** camelCase (`uploadFile`, `validateType`)
- **Files:** kebab-case (`file-upload-card.tsx`, `file-schemas.ts`)
- **Types/Interfaces:** PascalCase with descriptive names (`FileSchema`, `ColumnDefinition`)

### Styling

- Tailwind CSS utility-first — no inline styles or CSS modules
- Use `cn()` from `@/lib/utils` for conditional/merged classnames
- CSS variables defined in `globals.css` for theming (light/dark mode)
- Follow the color palette in `docs/blueprint.md`: primary Deep Blue (#1E3A8A), accent Steel Blue (#4A6EA3)

### Component Guidelines

- Prefer composition over prop sprawl
- Keep components focused — one responsibility per file
- Destructure props with typed interfaces
- Use `Sonner` (via `sonner` package) for toast notifications, not the shadcn toast
- Animations should be subtle — match existing transition patterns

### Error Handling

- Validate at system boundaries: file uploads, API responses, environment variables
- Use Zod schemas for runtime validation of external data
- Return descriptive error messages to the user via toast notifications
- Server actions should catch errors and return structured error responses, never throw to the client

### Imports

- Group imports: React/Next → third-party → local (`@/`) → types
- No barrel exports from `src/` root — import directly from specific files

## File Validation Rules

Four CSV file types, each with a strict schema:
- **election-results:** 43 columns (votes, candidates, outcomes)
- **elections:** 13 columns (authority, election info, dates)
- **voter-history:** 36 columns (voter details, participation)
- **poll-sites:** 13 columns (location, jurisdiction)

Validation constraints:
- Max file size: 5MB
- CSV only
- Headers must match schema exactly
- Data types enforced: string, number, boolean, date (mm/dd/yyyy)
- First 5 data rows validated on upload

## Infrastructure & Deployment

### Environment Variables

- `GCS_BUCKET_NAME` — required, Google Cloud Storage bucket name
- `GCLOUD_PROJECT` — required in deployed environments, GCP project ID
- Google Cloud service account credentials must be available at runtime (via `GOOGLE_APPLICATION_CREDENTIALS` or Cloud Run metadata server)

### Deployment

- **Primary:** Google Cloud Run via GitHub Actions (`.github/workflows/deploy.yml`)
- UAT auto-deploys on push to `main`; production deploys are manual (`workflow_dispatch`)
- **Docker:** Multi-stage build targeting Node 20 Alpine, port 8080
- **Cloud Build:** Alternative pipeline via `cloudbuild.yaml` (builds app + malware scanner)
- **Firebase App Hosting:** Legacy config in `apphosting.yaml` (max 1 instance)

### Cloud Services

- **Cloud Run:** Hosts the Next.js app and the malware scanner service
- **Google Cloud Storage:** File storage — interim, clean, and quarantine buckets
- **Google BigQuery:** Validated election data storage and querying (`@google-cloud/bigquery`)
- **Firestore:** Submission logs, election events, file versions, certifications (`firebase-admin`)
- **Artifact Registry:** Docker image storage
- **Eventarc:** Triggers malware scanning on new file uploads to GCS

## Git Workflow

- Feature branches merged via pull requests to `main`
- Write clear, descriptive commit messages
- No pre-commit hooks are configured

## Known Quirks

- `npm install` requires `--legacy-peer-deps` flag — will fail without it
- TypeScript and ESLint errors are **ignored during production builds** (`next.config.mjs`) — do not rely on the build to catch type errors; run `npx tsc --noEmit` separately
- The app connects to production GCP services in dev — there are no local emulators in active use
- No test framework is currently configured
