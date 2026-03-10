# VoteVault Security Audit

**Date:** 2026-03-10
**Scope:** Full codebase review — server actions, file parsing, infrastructure config, client components

---

## Protections In Place

### BigQuery Injection — PASS

All 23 BigQuery queries use parameterized queries (`@param` syntax with a `params` object). No user input is ever concatenated into SQL strings. The `table()` helper in `actions.ts` only accepts hardcoded table names.

```typescript
// Example — safe parameterized query
const dupQuery = `SELECT id FROM ${table('election_events')} WHERE election_name = @name AND election_authority_name = @authority LIMIT 1`;
const [dupRows] = await bq.query({
  query: dupQuery,
  params: { name: data.electionName, authority: data.electionAuthorityName },
});
```

### XSS — PASS

No use of `dangerouslySetInnerHTML`, `eval()`, or `new Function()`. All user-provided content is rendered through React text nodes, which auto-escape HTML.

### Input Validation (Zod)

All four public server actions now validate inputs with Zod schemas before processing:

| Action | Schema | Validates |
|--------|--------|-----------|
| `createElectionEvent` | `createElectionEventSchema` | String lengths, required fields |
| `certifyNoElections` | `certifyNoElectionsSchema` | Year range (1900–2200), string lengths |
| `submitAttestation` | `submitAttestationSchema` | UUID format, enum file types, enum attestation types |
| `uploadFile` | `uploadFileSchema` | Enum file types, UUID event IDs, string lengths |

Invalid input is rejected with a generic error message before any database or storage calls are made.

### CSV Formula Injection Protection

`toCsvString()` in `file-parser.ts` prefixes cell values starting with `=`, `+`, `-`, `@`, tab, or carriage return with a single-quote character. This prevents spreadsheet applications from interpreting CSV cell values as formulas.

### Security Headers

`next.config.mjs` returns the following headers on all routes:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking via iframes |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables unnecessary browser APIs |

### Error Message Sanitization

Server action catch blocks return generic user-facing messages instead of forwarding internal `error.message` strings. Full error details are logged server-side only via `console.error`.

### Filename Sanitization

Uploaded filenames are stripped of path traversal sequences (`../`) and non-printable characters before being used in GCS paths or stored in BigQuery.

### File Upload Constraints

- 5 MB maximum file size enforced server-side
- CSV MIME type check before parsing
- Header column count and names validated against schema
- First 5 data rows type-checked (string, number, boolean, date)
- Shapefile uploads are converted and re-serialized (not stored raw)

### External Image Domains Removed

Placeholder image domains (`placehold.co`, `images.unsplash.com`, `picsum.photos`) have been removed from the Next.js `remotePatterns` config, eliminating unnecessary external resource loading.

---

## Recommendations — Action Required

### Critical

#### 1. Implement User Authentication

**File:** `src/app/actions.ts:79`

The current user is hardcoded:

```typescript
const CURRENT_USER = "Ryan Richmond";
```

All audit logs, file versions, and certifications are attributed to this single identity. There is no login flow, session management, or identity verification.

**Recommendation:** Integrate an authentication provider (NextAuth.js, Clerk, or Google Identity Platform) and extract the current user from the server-side session. This is a prerequisite for production use.

#### 2. Implement Role-Based Access Control

There is no authorization layer. Any authenticated user can operate on any election authority's data — creating events, uploading files, deleting records, and certifying no-elections.

**Recommendation:** After authentication is in place, add middleware or server-action guards that verify the current user has permission to act on behalf of the requested election authority.

### High

#### 3. Restrict Malware Scanner IAM Roles

**File:** `infra/terraform/main.tf:69-85`

The scanner service account has `roles/storage.objectAdmin` on all three buckets (unscanned, clean, quarantine). This grants full create/read/update/delete on every object.

**Recommendation:** Create custom IAM roles with minimum necessary permissions:
- Unscanned bucket: `storage.objects.get` + `storage.objects.delete`
- Clean bucket: `storage.objects.create`
- Quarantine bucket: `storage.objects.create`

#### 4. Scope Cloud Build IAM

**File:** `infra/terraform/main.tf:110-114`

Cloud Build has `roles/eventarc.admin`, which grants full control over all Eventarc triggers in the project.

**Recommendation:** Replace with a custom role scoped to the specific malware scanner trigger, or manage the trigger directly via Terraform instead of granting Cloud Build admin access.

#### 5. Authenticate Malware Scanner Endpoint

**File:** `infra/malware-scanner/main.py:332`

The Flask endpoint accepts unauthenticated POST requests. While Cloud Run's `--no-allow-unauthenticated` flag provides a layer of protection, the application itself does not validate CloudEvent signatures or caller identity.

**Recommendation:** Validate the `Authorization` header using Google's ID token verification, or restrict the Cloud Run service to only accept invocations from the Eventarc service account.

### Medium

#### 6. Add Rate Limiting

The `uploadFile` server action has no throttling. An attacker with access could rapidly upload files to exhaust GCS quotas or spam BigQuery.

**Recommendation:** Add per-IP rate limiting at the Cloud Run or reverse proxy level. Once authentication exists, add per-user rate limits.

#### 7. Pin Docker Base Images

**File:** `Dockerfile:1,8`

```dockerfile
FROM node:20-alpine AS builder
FROM node:20-alpine AS runner
```

Unpinned tags can pull different image versions across builds, potentially introducing vulnerabilities.

**Recommendation:** Pin to a specific digest or version tag:
```dockerfile
FROM node:20.11.1-alpine3.19 AS builder
```

#### 8. Validate Malware Scanner Input Paths

**File:** `infra/malware-scanner/main.py:76-82`

The scanner trusts `object_name` from the CloudEvent payload without path validation. A crafted event could include path traversal sequences.

**Recommendation:** Reject object names containing `..` or starting with `/`:
```python
if ".." in object_name or object_name.startswith("/"):
    return ("Invalid object name", 400)
```

#### 9. Fix TypeScript and ESLint Build Checks

**File:** `next.config.mjs:3-8`

Both `ignoreBuildErrors` and `ignoreDuringBuilds` are set to `true`, meaning type errors and lint violations do not block deployments.

**Recommendation:** Resolve the underlying type/lint errors and remove these flags. As an interim step, add `npx tsc --noEmit` to the CI pipeline as a required check.

### Low

#### 10. Add Bucket Lifecycle Policies

**File:** `infra/terraform/main.tf:122-123`

Quarantine bucket has no auto-deletion policy. Malicious files accumulate indefinitely.

**Recommendation:** Add a Terraform lifecycle rule to auto-delete quarantine objects after 90 days.

#### 11. Audit BigQuery Schema Changes

**File:** `src/lib/bigquery.ts`

The `ensureSchema()` function auto-creates tables without logging. Schema changes in an election system should be auditable.

**Recommendation:** Log schema creation/modification events to a separate audit table or to Cloud Audit Logs.

#### 12. Add Content Security Policy Header

A full CSP header was not added because the application uses inline styles (Tailwind) and may require `unsafe-inline` for scripts during development. A permissive CSP provides limited value.

**Recommendation:** Once the application's script/style sources are fully characterized, add a strict CSP with nonce-based script loading. Start with report-only mode:
```
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'nonce-{random}'; style-src 'self' 'unsafe-inline'
```
