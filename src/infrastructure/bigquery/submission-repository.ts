/**
 * @file Repository for submission log and file version BigQuery operations.
 *
 * Encapsulates all SQL queries and row-mapping logic for the `submission_logs`
 * and `file_versions` tables so that higher-level services never touch raw SQL.
 */

import { randomUUID } from 'crypto';
import type { SubmissionLogEntry, FileVersionEntry } from '@/domain/types';
import { bq, ensureSchema, table } from '@/infrastructure/bigquery/client';

// ---------------------------------------------------------------------------
// Submission logs
// ---------------------------------------------------------------------------

/** Insert a submission log row. */
export async function insertSubmissionLog(params: {
  fileName: string;
  fileType: string;
  success: boolean;
  message: string;
  uploadedBy: string;
  electionEventId?: string;
}): Promise<void> {
  try {
    await ensureSchema();
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const scanStatus = params.success ? 'pending_scan' : null;

    const query = `INSERT INTO ${table('submission_logs')} (id, timestamp, file_name, file_type, success, message, uploaded_by, election_event_id, scan_status)
      VALUES (@id, @timestamp, @fileName, @fileType, @success, @message, @uploadedBy, @eventId, @scanStatus)`;

    await bq.query({
      query,
      params: {
        id,
        timestamp,
        fileName: params.fileName,
        fileType: params.fileType,
        success: params.success,
        message: params.message,
        uploadedBy: params.uploadedBy,
        eventId: params.electionEventId ?? null,
        scanStatus,
      },
    });
  } catch (error) {
    console.error('Failed to log submission to BigQuery:', error);
  }
}

/** Fetch submission logs, optionally filtered by event. */
export async function fetchSubmissionLogs(electionEventId?: string): Promise<SubmissionLogEntry[]> {
  try {
    await ensureSchema();
    let query: string;
    const params: Record<string, string> = {};

    if (electionEventId) {
      query = `SELECT * FROM ${table('submission_logs')} WHERE election_event_id = @eventId ORDER BY timestamp DESC LIMIT 50`;
      params.eventId = electionEventId;
    } else {
      query = `SELECT * FROM ${table('submission_logs')} ORDER BY timestamp DESC LIMIT 50`;
    }

    const [rows] = await bq.query({ query, params, useQueryCache: false });

    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id ?? ''),
      timestamp: row.timestamp ? (row.timestamp as { value: string }).value ?? String(row.timestamp) : new Date().toISOString(),
      fileName: String(row.file_name ?? ''),
      fileType: String(row.file_type ?? ''),
      success: Boolean(row.success),
      message: String(row.message ?? ''),
      uploadedBy: String(row.uploaded_by ?? ''),
      electionEventId: String(row.election_event_id ?? ''),
      scanStatus: row.scan_status ? String(row.scan_status) : undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch submission logs:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// File versions
// ---------------------------------------------------------------------------

/** Create a new file version, deactivating prior versions. */
export async function insertFileVersion(params: {
  fileType: string;
  fileName: string;
  gcsPath: string;
  electionAuthorityName: string;
  electionAuthorityType: string;
  amendmentNotes: string;
  uploadedBy: string;
  electionEventId?: string;
}): Promise<void> {
  try {
    await ensureSchema();

    // Find the latest version for this fileType + authority + event
    let versionQuery = `SELECT IFNULL(MAX(version), 0) AS max_version FROM ${table('file_versions')} WHERE file_type = @fileType AND election_authority_name = @authorityName`;
    const versionParams: Record<string, string> = {
      fileType: params.fileType,
      authorityName: params.electionAuthorityName,
    };
    if (params.electionEventId) {
      versionQuery += ` AND election_event_id = @eventId`;
      versionParams.eventId = params.electionEventId;
    }

    const [versionRows] = await bq.query({ query: versionQuery, params: versionParams });
    const maxVersion = Number((versionRows as Record<string, unknown>[])[0]?.max_version ?? 0);
    const nextVersion = maxVersion + 1;

    // Mark all previous versions for this fileType + authority + event as inactive
    if (maxVersion > 0) {
      let deactivateQuery = `UPDATE ${table('file_versions')} SET is_active = FALSE WHERE file_type = @fileType AND election_authority_name = @authorityName AND is_active = TRUE`;
      const deactivateParams: Record<string, string> = {
        fileType: params.fileType,
        authorityName: params.electionAuthorityName,
      };
      if (params.electionEventId) {
        deactivateQuery += ` AND election_event_id = @eventId`;
        deactivateParams.eventId = params.electionEventId;
      }
      await bq.query({ query: deactivateQuery, params: deactivateParams });
    }

    // Insert new version record via DML for immediate consistency
    const id = randomUUID();
    const uploadedAt = new Date().toISOString();

    const insertQuery = `INSERT INTO ${table('file_versions')} (id, file_type, file_name, gcs_path, version, uploaded_at, election_authority_name, election_authority_type, amendment_notes, is_active, uploaded_by, election_event_id)
      VALUES (@id, @fileType, @fileName, @gcsPath, @version, @uploadedAt, @authorityName, @authorityType, @amendmentNotes, @isActive, @uploadedBy, @eventId)`;

    await bq.query({
      query: insertQuery,
      params: {
        id,
        fileType: params.fileType,
        fileName: params.fileName,
        gcsPath: params.gcsPath,
        version: nextVersion,
        uploadedAt,
        authorityName: params.electionAuthorityName,
        authorityType: params.electionAuthorityType,
        amendmentNotes: params.amendmentNotes || '',
        isActive: true,
        uploadedBy: params.uploadedBy,
        eventId: params.electionEventId ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to create file version record:', error);
  }
}

/** Fetch all versions of a file type for an authority. */
export async function fetchFileVersions(
  fileType: string,
  electionAuthorityName: string,
): Promise<FileVersionEntry[]> {
  try {
    await ensureSchema();
    const query = `SELECT * FROM ${table('file_versions')} WHERE file_type = @fileType AND election_authority_name = @authorityName ORDER BY version DESC`;
    const [rows] = await bq.query({
      query,
      params: { fileType, authorityName: electionAuthorityName },
    });

    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id ?? ''),
      fileType: String(row.file_type ?? ''),
      fileName: String(row.file_name ?? ''),
      gcsPath: String(row.gcs_path ?? ''),
      version: Number(row.version ?? 1),
      uploadedAt: row.uploaded_at ? (row.uploaded_at as { value: string }).value ?? String(row.uploaded_at) : new Date().toISOString(),
      electionAuthorityName: String(row.election_authority_name ?? ''),
      electionAuthorityType: String(row.election_authority_type ?? ''),
      amendmentNotes: String(row.amendment_notes ?? ''),
      isActive: Boolean(row.is_active),
      uploadedBy: String(row.uploaded_by ?? ''),
      electionEventId: String(row.election_event_id ?? ''),
    }));
  } catch (error) {
    console.error('Failed to fetch file versions:', error);
    return [];
  }
}

/** Fetch active file versions for an authority. */
export async function fetchActiveFileVersions(
  electionAuthorityName: string,
): Promise<FileVersionEntry[]> {
  try {
    await ensureSchema();
    const query = `SELECT * FROM ${table('file_versions')} WHERE election_authority_name = @authorityName AND is_active = TRUE`;
    const [rows] = await bq.query({
      query,
      params: { authorityName: electionAuthorityName },
    });

    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id ?? ''),
      fileType: String(row.file_type ?? ''),
      fileName: String(row.file_name ?? ''),
      gcsPath: String(row.gcs_path ?? ''),
      version: Number(row.version ?? 1),
      uploadedAt: row.uploaded_at ? (row.uploaded_at as { value: string }).value ?? String(row.uploaded_at) : new Date().toISOString(),
      electionAuthorityName: String(row.election_authority_name ?? ''),
      electionAuthorityType: String(row.election_authority_type ?? ''),
      amendmentNotes: String(row.amendment_notes ?? ''),
      isActive: Boolean(row.is_active),
      uploadedBy: String(row.uploaded_by ?? ''),
      electionEventId: String(row.election_event_id ?? ''),
    }));
  } catch (error) {
    console.error('Failed to fetch active file versions:', error);
    return [];
  }
}

/** Deactivate all file versions for an election event. */
export async function deactivateFileVersionsByEvent(electionEventId: string): Promise<void> {
  try {
    await ensureSchema();
    const deactivateQuery = `UPDATE ${table('file_versions')} SET is_active = FALSE WHERE election_event_id = @eventId`;
    await bq.query({ query: deactivateQuery, params: { eventId: electionEventId } });
  } catch (error) {
    console.error('Failed to deactivate file versions for event:', error);
  }
}
