# VoteVault

A secure web platform for uploading and validating election-related CSV data for the New York State Board of Elections. Data is validated against strict schemas, scanned for malware, and stored in Google Cloud Storage and BigQuery.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [CSV File Types & Validation](#csv-file-types--validation)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Infrastructure](#infrastructure)
- [Tech Stack](#tech-stack)
- [Development Notes](#development-notes)

## Prerequisites

- **Node.js** 20 or higher
- **npm** (comes with Node.js)
- **Docker** (for containerized builds/deployment)
- **Google Cloud** service account credentials (for GCS, BigQuery, and Firestore access)

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd VEDA-file-intake
   ```

2. **Install dependencies:**

   ```bash
   npm install --legacy-peer-deps
   ```

   > The `--legacy-peer-deps` flag is **required** — installation will fail without it.

3. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in your values (see [Environment Variables](#environment-variables)).

4. **Start the development server:**

   ```bash
   npm run dev
   ```

   The app will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # Main page — NYS banner, dashboard, election selector
│   ├── layout.tsx              # Root layout, metadata, Inter font, Toaster provider
│   ├── actions.ts              # Thin routing layer — delegates to services
│   └── globals.css             # CSS variables, theme tokens (light/dark)
├── domain/                     # Pure business logic & types (no infrastructure deps)
│   ├── types.ts                # Canonical type definitions
│   ├── validation/rules.ts     # CSV validation (pure functions)
│   └── election/               # Attestation rules, compliance, naming
├── content/                    # User-facing strings (localization-ready)
│   ├── common.ts               # Shared labels, status terms
│   ├── upload.ts               # Upload wizard strings
│   ├── validation-messages.ts  # Validation error messages
│   ├── elections.ts            # Election dialog strings
│   └── dashboard.ts            # Dashboard UI strings
├── services/                   # Business orchestration
│   ├── upload-service.ts       # File upload lifecycle
│   ├── election-service.ts     # Election CRUD
│   ├── audit-service.ts        # Submission logs & file versioning
│   ├── attestation-service.ts  # Attestation eligibility & submission
│   └── certification-service.ts # No-elections certification
├── infrastructure/             # Data access & external services
│   ├── bigquery/               # Repository per table (election, submission, etc.)
│   └── storage/gcs-client.ts   # Google Cloud Storage operations
├── components/
│   ├── dashboard.tsx           # Main dashboard UI
│   ├── upload-wizard.tsx       # Primary upload interface (step-by-step)
│   ├── file-upload-card.tsx    # Drag-and-drop file upload component
│   └── ...                     # Dialogs, selectors, banners, sidebar (see CLAUDE.md)
├── hooks/                      # use-toast, use-mobile
├── lib/                        # Shared utilities
│   ├── file-schemas.ts         # Zod schemas for all 4 CSV file types
│   ├── file-parser.ts          # CSV parsing utilities
│   ├── header-matching.ts      # Fuzzy column header matching / normalization
│   ├── bigquery.ts             # BigQuery client and auto-schema provisioning
│   ├── shapefile-converter.ts  # Shapefile → GeoJSON conversion
│   └── utils.ts                # cn() classname merge utility
└── types/
    └── shapefile.d.ts          # TypeScript declarations for shapefile lib

infra/
├── malware-scanner/            # ClamAV-based malware scanning service
│   ├── Dockerfile
│   ├── main.py                 # Scanner HTTP endpoint
│   ├── requirements.txt
│   ├── entrypoint.sh
│   └── config/                 # ClamAV configuration
└── terraform/                  # Infrastructure as Code
    ├── main.tf
    ├── variables.tf
    └── terraform.tfvars.example

docs/
├── blueprint.md                # Design guidelines, color palette, typography
├── security-audit.md           # Security audit findings and recommendations
└── architecture-refactor.md    # Architecture refactor documentation
```

## Architecture

VoteVault is a **Next.js 14** application using the App Router, organized in a Clean Architecture with four layers:

```
actions.ts (thin routing) → services (orchestration) → domain + content + infrastructure
```

| Layer | Location | Responsibility |
|---|---|---|
| **Domain** | `src/domain/` | Pure business logic, types, validation rules — no infrastructure deps |
| **Content** | `src/content/` | All user-facing strings, centralized for localization |
| **Services** | `src/services/` | Orchestrates domain rules + infrastructure, returns structured results |
| **Infrastructure** | `src/infrastructure/` | Data access (BigQuery repositories, GCS storage) — no business logic |

For full details on the refactoring, see [`docs/architecture-refactor.md`](docs/architecture-refactor.md).

### Key Patterns

- **Server actions** (`"use server"`) are a thin routing layer that delegates to service functions
- **Services** catch all errors and return `{ success, message }` — they never throw to the client
- **Zod schemas** enforce strict CSV validation at upload time (headers + first 5 data rows)
- **shadcn/ui** provides the component library — built on Radix UI primitives
- **Election Authority context** scopes all data operations to the selected board of elections

### Data Flow

1. User selects an election authority and election event
2. User uploads a CSV file via the upload wizard
3. File is validated client-side (size, format) and server-side (schema, column headers, data types)
4. Fuzzy header matching reconciles column name variations
5. Valid files are uploaded to Google Cloud Storage
6. Data is written to BigQuery for querying
7. Submission is logged to Firestore for audit trail
8. Uploaded files pass through the ClamAV malware scanner via Eventarc triggers

## CSV File Types & Validation

Four CSV file types, each with a strict column schema:

| File Type | Columns | Description |
|---|---|---|
| **Election Results** | 43 | Votes, candidates, outcomes by district |
| **Elections** | 13 | Election authority info, election dates |
| **Voter History** | 36 | Voter details, participation records |
| **Poll Sites** | 13 | Polling location and jurisdiction data |

**Validation rules:**

- File format: CSV only
- Max file size: 5 MB
- Headers must match the schema (fuzzy matching supported via aliases)
- Data types enforced: `string`, `number`, `boolean`, `date` (mm/dd/yyyy)
- First 5 data rows are validated on upload

Schemas are defined in [`src/lib/file-schemas.ts`](src/lib/file-schemas.ts).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GCS_BUCKET_NAME` | Yes | Google Cloud Storage bucket for file uploads |
| `GCLOUD_PROJECT` | Yes (prod) | GCP project ID — set via deployment config |

Google Cloud service account credentials must be available at runtime (either via `GOOGLE_APPLICATION_CREDENTIALS` or the metadata server on Cloud Run).

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

## Deployment

VoteVault deploys to **Google Cloud Run** via Docker containers.

### CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) handles automated deployments:

- **UAT:** Auto-deploys on every push to `main`
- **Production:** Manual trigger via `workflow_dispatch`

The pipeline:
1. Authenticates to GCP via Workload Identity Federation
2. Builds and tags a Docker image
3. Pushes to Google Artifact Registry
4. Deploys to Cloud Run with environment variables

### Manual Docker Build

```bash
docker build -t votevault .
docker run -p 8080:8080 \
  -e GCS_BUCKET_NAME=your-bucket \
  -e GCLOUD_PROJECT=your-project \
  votevault
```

### Cloud Build

An alternative `cloudbuild.yaml` is provided for GCP-native CI/CD via Cloud Build. It builds and deploys both the web application and the malware scanner service.

## Infrastructure

### Cloud Services

| Service | Purpose |
|---|---|
| **Cloud Run** | Hosts the Next.js application and malware scanner |
| **Google Cloud Storage** | Stores uploaded CSV files (interim → clean/quarantine buckets) |
| **BigQuery** | Stores validated election data for querying |
| **Firestore** | Submission logs, election events, file versions, certifications |
| **Artifact Registry** | Docker image storage |
| **Eventarc** | Triggers malware scanning on new file uploads |

### Malware Scanner

A ClamAV-based scanner runs as a separate Cloud Run service (`infra/malware-scanner/`). When a file is uploaded to the interim bucket, an Eventarc trigger invokes the scanner, which moves clean files to the clean bucket and infected files to quarantine.

See [`infra/MALWARE-SCANNING.md`](infra/MALWARE-SCANNING.md) for details.

### Terraform

Infrastructure provisioning is defined in `infra/terraform/`. Copy `terraform.tfvars.example` to `terraform.tfvars` and fill in your project-specific values before running `terraform apply`.

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript (strict mode) |
| **UI Components** | shadcn/ui + Radix UI primitives |
| **Styling** | Tailwind CSS |
| **Forms & Validation** | React Hook Form + Zod |
| **Toasts** | Sonner |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Cloud Storage** | @google-cloud/storage |
| **Database** | @google-cloud/bigquery, firebase-admin (Firestore) |
| **File Processing** | xlsx, shapefile, jszip |
| **Deployment** | Docker, Cloud Run, GitHub Actions |

## Development Notes

### Available Scripts

```bash
npm run dev       # Start development server (http://localhost:3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

### Type Checking

TypeScript and ESLint errors are **ignored during production builds** (configured in `next.config.mjs`). To catch type errors during development, run:

```bash
npx tsc --noEmit
```

### Code Conventions

- **Path alias:** `@/*` maps to `./src/*` — always use it over relative imports
- **File naming:** kebab-case for files, PascalCase for components
- **Styling:** Tailwind utility classes only; use `cn()` from `@/lib/utils` for conditional classes
- **Error handling:** Server actions catch errors and return structured responses; never throw to the client
- **Notifications:** Use Sonner (`sonner` package) for toast notifications

For full coding conventions, see [`CLAUDE.md`](CLAUDE.md).

### No Test Framework

There is currently no test framework configured. This is a known gap.

## Git Workflow

- Feature branches merged via pull requests to `main`
- UAT auto-deploys on merge to `main`
- Production deploys are triggered manually
