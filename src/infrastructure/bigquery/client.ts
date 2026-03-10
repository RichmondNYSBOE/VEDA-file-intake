/**
 * @file Centralized BigQuery client re-exports and shared helpers.
 *
 * Re-exports the singleton BigQuery client, dataset constant, and schema
 * provisioning function from `@/lib/bigquery` so that all infrastructure
 * modules import from a single location. Also houses shared constants and
 * utility functions used across multiple repositories.
 */

import type { ElectionEventFileStatus } from '@/domain/types';

// ---------------------------------------------------------------------------
// Re-exports from @/lib/bigquery
// ---------------------------------------------------------------------------

export { bq, DATASET, ensureSchema } from '@/lib/bigquery';
import { DATASET } from '@/lib/bigquery';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hard-coded current user (auth to be added later). */
export const CURRENT_USER = 'Ryan Richmond';

/** Default file status for newly created election events. */
export const DEFAULT_FILE_STATUS: ElectionEventFileStatus = { uploaded: false };

/** The canonical set of file types tracked per election event. */
export const FILE_TYPES = ['poll-sites', 'election-results', 'voter-information', 'district-maps'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fully-qualified BigQuery table reference. */
export function table(name: string): string {
  return `\`${DATASET}.${name}\``;
}

/**
 * Convert the REPEATED files record from BigQuery into the
 * `Record<string, ElectionEventFileStatus>` shape used by the domain.
 */
export function parseFilesRecord(
  files: Array<Record<string, unknown>> | undefined | null,
): Record<string, ElectionEventFileStatus> {
  const result: Record<string, ElectionEventFileStatus> = {};
  for (const ft of FILE_TYPES) {
    result[ft] = { ...DEFAULT_FILE_STATUS };
  }
  if (Array.isArray(files)) {
    for (const f of files) {
      const ft = String(f.file_type ?? '');
      if (ft) {
        result[ft] = {
          uploaded: Boolean(f.uploaded),
          fileName: f.file_name ? String(f.file_name) : undefined,
          uploadedAt: f.uploaded_at ? String(f.uploaded_at) : undefined,
          uploadedBy: f.uploaded_by ? String(f.uploaded_by) : undefined,
          version: f.version ? Number(f.version) : undefined,
          gcsPath: f.gcs_path ? String(f.gcs_path) : undefined,
        };
      }
    }
  }
  return result;
}

/**
 * Convert `Record<string, ElectionEventFileStatus>` to the BigQuery REPEATED
 * struct format expected by the `election_events.files` column.
 */
export function serializeFilesRecord(
  files: Record<string, ElectionEventFileStatus>,
): Array<Record<string, unknown>> {
  return Object.entries(files).map(([fileType, status]) => ({
    file_type: fileType,
    uploaded: status.uploaded,
    file_name: status.fileName ?? null,
    uploaded_at: status.uploadedAt ?? null,
    uploaded_by: status.uploadedBy ?? null,
    version: status.version ?? null,
    gcs_path: status.gcsPath ?? null,
  }));
}
