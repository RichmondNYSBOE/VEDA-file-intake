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

```
src/
  app/
    page.tsx          # Home page — file upload cards grid
    layout.tsx        # Root layout, metadata, Toaster provider
    actions.ts        # Server actions (uploadFile to GCS)
  components/
    file-upload-card.tsx  # Main interactive upload component
    icons.tsx             # Custom VoteVault icon
    ui/                   # shadcn/ui component library (26+ components)
  hooks/
    use-toast.ts      # Toast notification hook
    use-mobile.tsx    # Mobile detection hook
  lib/
    file-schemas.ts   # CSV validation schemas for all 4 file types
    utils.ts          # cn() classname utility
docs/
  blueprint.md        # Design guidelines, color palette, typography
```

### Key Patterns

- **Server actions** (`"use server"`) for all mutations and file uploads
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
- Google Cloud service account credentials must be available at runtime

### Deployment

- **Primary:** Firebase App Hosting (`apphosting.yaml`) — max 1 instance, auto-scaling disabled
- **Docker:** Multi-stage build targeting Node 20 Alpine, port 8080
- Firebase Studio (`.idx/`) configured for cloud-based development

### Cloud Services

- **Google Cloud Storage:** File storage destination (`@google-cloud/storage`)
- **Google BigQuery:** Data querying (`@google-cloud/bigquery`)
- **Firebase Admin SDK:** Backend auth and services (`firebase-admin`)

## Git Workflow

- Feature branches merged via pull requests to `main`
- Write clear, descriptive commit messages
- No pre-commit hooks are configured

## Known Quirks

- `npm install` requires `--legacy-peer-deps` flag — will fail without it
- TypeScript and ESLint errors are **ignored during production builds** (`next.config.mjs`) — do not rely on the build to catch type errors; run `npx tsc --noEmit` separately
- Firebase emulators are disabled in dev config — the app uses production backend services
- No test framework is currently configured
