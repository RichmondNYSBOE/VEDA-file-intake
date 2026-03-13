# File Transfer Architecture Changes

## Problem

The original upload flow sends files through a Next.js server action as FormData.
This path has two hard ceilings that cannot be configured away:

| Layer | Limit |
|---|---|
| Next.js server actions (default) | 1 MB request body |
| Google Cloud Run | 32 MB request body |

Even after raising the Next.js limit, Cloud Run's 32 MB cap is a platform-level
constraint. Voter History files for large counties can exceed 1 million rows
(~500 MB as CSV), so the entire server-relay approach is insufficient.

The application-level 5 MB limit was a synthetic guard that masked these real
constraints.

## Solution — GCS Signed Upload URLs

Instead of relaying the file through the server, the browser uploads directly to
Google Cloud Storage using a **signed resumable upload URL**.

### New flow

```
Browser                          Next.js Server              GCS
  │                                   │                        │
  │  1. getSignedUploadUrl (metadata) │                        │
  │ ─────────────────────────────────>│                        │
  │                                   │  generate signed URL   │
  │                                   │ ──────────────────────>│
  │          { url, destination }     │                        │
  │ <─────────────────────────────────│                        │
  │                                   │                        │
  │  2. PUT file directly (resumable) │                        │
  │ ──────────────────────────────────────────────────────────>│
  │         (progress events)         │                        │
  │ <──────────────────────────────────────────────────────────│
  │                                   │                        │
  │  3. confirmUpload (metadata)      │                        │
  │ ─────────────────────────────────>│                        │
  │                                   │  read first 64 KB      │
  │                                   │ ──────────────────────>│
  │                                   │  validate headers/rows │
  │                                   │  log audit + version   │
  │          { success, message }     │                        │
  │ <─────────────────────────────────│                        │
```

### Why this works for large files

- **No server relay**: the file never passes through the Next.js process or
  Cloud Run's request body limit.
- **Resumable uploads**: GCS resumable uploads handle files up to 5 TB with
  automatic retry on network interruption.
- **Low server memory**: the server only reads the first 64 KB of the uploaded
  file (for header/row validation), not the entire file.
- **Progress tracking**: `XMLHttpRequest` progress events give the user a real
  percentage indicator instead of an indeterminate spinner.

### What stays the same

- **Client-side validation**: header matching, column reordering, and data
  preview still happen in the browser before upload.
- **Server-side validation**: after upload, the server re-validates CSV headers
  and sample rows as defense-in-depth.
- **Malware scanning**: the ClamAV scanner still triggers on GCS object
  finalization (Eventarc). Its size limit is raised to match.
- **Audit trail**: submission logs, file versions, and election event status
  updates are unchanged.
- **District maps**: small files (shapefiles, GeoJSON) still use the original
  server-relay flow because they need server-side format conversion.

## Size Limits

| File type | Old limit | New limit |
|---|---|---|
| CSV data files (election-results, elections, voter-history, poll-sites) | 5 MB | 1 GB |
| District maps (shapefile, GeoJSON) | 5 MB | 5 MB (unchanged) |

The 1 GB ceiling is an over-provision. Typical maximum is ~500 MB for the
largest county Voter History files (~1 million rows).

## Infrastructure Changes

| Component | Change | Reason |
|---|---|---|
| Malware scanner `MAX_SCAN_SIZE_BYTES` | 5 MB → 1 GB | Match new upload limit |
| Scanner Cloud Run memory | 2 Gi → 4 Gi | ClamAV needs headroom for large files |
| Scanner Cloud Run CPU | 1 → 2 | Faster scanning |
| Scanner timeout | 300 s → 900 s | Large files take longer to scan |
| GCS upload bucket | Add CORS policy | Required for browser-direct uploads |

## Client-Side Optimization

For CSV files larger than ~10 MB, only the first 64 KB is read into memory for
header validation and data preview. This prevents the browser from loading
500 MB+ into memory just to check column names.
