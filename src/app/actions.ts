/**
 * @file Server actions module containing all server-side mutations and queries.
 *
 * Responsibilities include: file upload and validation (CSV schemas, shapefile-to-GeoJSON
 * conversion), submission audit logging, file version tracking, election event CRUD,
 * and no-elections certifications. All BigQuery tables are auto-provisioned via ensureSchema().
 */

'use server'

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Storage } from '@google-cloud/storage';
import { fileSchemas, type FieldSchema } from '@/lib/file-schemas';
import { bq, DATASET, ensureSchema } from '@/lib/bigquery';
import { convertShapefileToGeoJSON, validateGeoJSON } from '@/lib/shapefile-converter';

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

const VALID_FILE_TYPES = ["poll-sites", "election-results", "voter-information", "district-maps"] as const;

const createElectionEventSchema = z.object({
  date: z.string().min(1).max(50),
  electionType: z.string().min(1).max(100),
  electionName: z.string().min(1).max(255),
  electionAuthorityName: z.string().min(1).max(255),
  electionAuthorityType: z.string().min(1).max(255),
});

const certifyNoElectionsSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  electionAuthorityName: z.string().min(1).max(255),
  electionAuthorityType: z.string().min(1).max(255),
});

const submitAttestationSchema = z.object({
  electionEventId: z.string().uuid(),
  fileType: z.enum(["poll-sites", "district-maps"]),
  attestationType: z.enum(["no-change", "state-geo-accurate"]),
  electionAuthorityName: z.string().min(1).max(255),
  electionAuthorityType: z.string().min(1).max(255),
});

const uploadFileSchema = z.object({
  fileType: z.enum(VALID_FILE_TYPES),
  electionAuthorityName: z.string().min(1).max(255).nullable(),
  electionAuthorityType: z.string().max(255).nullable(),
  amendmentNotes: z.string().max(1000).nullable(),
  electionEventId: z.string().uuid().nullable(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubmissionLogEntry {
  id: string;
  timestamp: string;
  fileName: string;
  fileType: string;
  success: boolean;
  message: string;
  uploadedBy?: string;
  electionEventId?: string;
  scanStatus?: string;
}

export interface FileVersionEntry {
  id: string;
  fileType: string;
  fileName: string;
  gcsPath: string;
  version: number;
  uploadedAt: string;
  electionAuthorityName: string;
  electionAuthorityType: string;
  amendmentNotes: string;
  isActive: boolean;
  uploadedBy?: string;
  electionEventId?: string;
}

export interface ElectionEventFileStatus {
  uploaded: boolean;
  fileName?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  version?: number;
  gcsPath?: string;
}

export interface ElectionEvent {
  id: string;
  date: string;
  electionType: string;
  electionName: string;
  electionAuthorityName: string;
  electionAuthorityType: string;
  createdAt: string;
  createdBy: string;
  files: Record<string, ElectionEventFileStatus>;
}

export interface NoElectionsCertification {
  id: string;
  year: number;
  electionAuthorityName: string;
  electionAuthorityType: string;
  certifiedAt: string;
  certifiedBy: string;
}

// Hard-coded current user (auth to be added later)
const CURRENT_USER = "Ryan Richmond";

/** Fully-qualified table reference. */
function table(name: string): string {
  return `\`${DATASET}.${name}\``;
}

// ---------------------------------------------------------------------------
// BigQuery helpers — Submission logs
// ---------------------------------------------------------------------------

/** Inserts an audit log entry into BigQuery's submission_logs table. */
async function logSubmission(
  fileName: string,
  fileType: string,
  success: boolean,
  message: string,
  electionEventId?: string,
): Promise<void> {
  try {
    await ensureSchema();
    const row = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      file_name: fileName,
      file_type: fileType,
      success,
      message,
      uploaded_by: CURRENT_USER,
      election_event_id: electionEventId ?? null,
      scan_status: success ? 'pending_scan' : null,
    };
    await bq.dataset(DATASET).table('submission_logs').insert([row]);
  } catch (error) {
    console.error('Failed to log submission to BigQuery:', error);
  }
}

/** Fetches the most recent 50 submission log entries, optionally filtered by election event. */
export async function getSubmissionLogs(electionEventId?: string): Promise<SubmissionLogEntry[]> {
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

    const [rows] = await bq.query({ query, params });

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
// File version tracking
// ---------------------------------------------------------------------------

/** Creates a new version record for a file, deactivating all prior versions for that file type and authority. */
async function createFileVersion(
  fileType: string,
  fileName: string,
  gcsPath: string,
  electionAuthorityName: string,
  electionAuthorityType: string,
  amendmentNotes: string,
  electionEventId?: string,
): Promise<void> {
  try {
    await ensureSchema();

    // Find the latest version for this fileType + authority + event
    let versionQuery = `SELECT IFNULL(MAX(version), 0) AS max_version FROM ${table('file_versions')} WHERE file_type = @fileType AND election_authority_name = @authorityName`;
    const versionParams: Record<string, string> = {
      fileType,
      authorityName: electionAuthorityName,
    };
    if (electionEventId) {
      versionQuery += ` AND election_event_id = @eventId`;
      versionParams.eventId = electionEventId;
    }

    const [versionRows] = await bq.query({ query: versionQuery, params: versionParams });
    const maxVersion = Number((versionRows as Record<string, unknown>[])[0]?.max_version ?? 0);
    const nextVersion = maxVersion + 1;

    // Mark all previous versions for this fileType + authority + event as inactive
    if (maxVersion > 0) {
      let deactivateQuery = `UPDATE ${table('file_versions')} SET is_active = FALSE WHERE file_type = @fileType AND election_authority_name = @authorityName AND is_active = TRUE`;
      const deactivateParams: Record<string, string> = {
        fileType,
        authorityName: electionAuthorityName,
      };
      if (electionEventId) {
        deactivateQuery += ` AND election_event_id = @eventId`;
        deactivateParams.eventId = electionEventId;
      }
      await bq.query({ query: deactivateQuery, params: deactivateParams });
    }

    // Insert new version record
    const row = {
      id: randomUUID(),
      file_type: fileType,
      file_name: fileName,
      gcs_path: gcsPath,
      version: nextVersion,
      uploaded_at: new Date().toISOString(),
      election_authority_name: electionAuthorityName,
      election_authority_type: electionAuthorityType,
      amendment_notes: amendmentNotes || '',
      is_active: true,
      uploaded_by: CURRENT_USER,
      election_event_id: electionEventId ?? null,
    };
    await bq.dataset(DATASET).table('file_versions').insert([row]);
  } catch (error) {
    console.error('Failed to create file version record:', error);
  }
}

/** Retrieves all versions (active and inactive) of a file type for an authority. */
export async function getFileVersions(
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

/** Retrieves only the currently active file versions for an authority. */
export async function getAllFileVersions(
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

// ---------------------------------------------------------------------------
// Election Events
// ---------------------------------------------------------------------------

const DEFAULT_FILE_STATUS: ElectionEventFileStatus = { uploaded: false };

const FILE_TYPES = ["poll-sites", "election-results", "voter-information", "district-maps"] as const;

/** Convert the REPEATED files record from BigQuery into the Record<string, ElectionEventFileStatus> shape. */
function parseFilesRecord(
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

/** Convert Record<string, ElectionEventFileStatus> to the BigQuery REPEATED struct. */
function serializeFilesRecord(
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

/** Creates a new election event after checking for duplicates by name and authority. */
export async function createElectionEvent(data: {
  date: string;
  electionType: string;
  electionName: string;
  electionAuthorityName: string;
  electionAuthorityType: string;
}): Promise<{ success: boolean; message: string; id?: string }> {
  try {
    const parsed = createElectionEventSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, message: 'Invalid input. Please check your entries and try again.' };
    }
    data = parsed.data;

    await ensureSchema();

    // Check for duplicate election events
    const dupQuery = `SELECT id FROM ${table('election_events')} WHERE election_name = @name AND election_authority_name = @authority LIMIT 1`;
    const [dupRows] = await bq.query({
      query: dupQuery,
      params: { name: data.electionName, authority: data.electionAuthorityName },
    });

    if ((dupRows as unknown[]).length > 0) {
      return {
        success: false,
        message: `An election event named "${data.electionName}" already exists for your authority. Please choose a different date or election type.`,
      };
    }

    const id = randomUUID();
    const defaultFiles: Record<string, ElectionEventFileStatus> = {};
    for (const ft of FILE_TYPES) {
      defaultFiles[ft] = { ...DEFAULT_FILE_STATUS };
    }

    const row = {
      id,
      date: data.date,
      election_type: data.electionType,
      election_name: data.electionName,
      election_authority_name: data.electionAuthorityName,
      election_authority_type: data.electionAuthorityType,
      created_at: new Date().toISOString(),
      created_by: CURRENT_USER,
      files: serializeFilesRecord(defaultFiles),
    };

    await bq.dataset(DATASET).table('election_events').insert([row]);

    return {
      success: true,
      message: `Election event "${data.electionName}" has been created.`,
      id,
    };
  } catch (error: unknown) {
    console.error('Failed to create election event:', error);
    return {
      success: false,
      message: 'Something went wrong while creating the election event. Please try again.',
    };
  }
}

/** Fetches all election events for an authority, ordered by creation date descending. */
export async function getElectionEvents(
  electionAuthorityName: string,
): Promise<ElectionEvent[]> {
  try {
    await ensureSchema();
    const query = `SELECT * FROM ${table('election_events')} WHERE election_authority_name = @authority ORDER BY created_at DESC`;
    const [rows] = await bq.query({
      query,
      params: { authority: electionAuthorityName },
    });

    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id ?? ''),
      date: String(row.date ?? ''),
      electionType: String(row.election_type ?? ''),
      electionName: String(row.election_name ?? ''),
      electionAuthorityName: String(row.election_authority_name ?? ''),
      electionAuthorityType: String(row.election_authority_type ?? ''),
      createdAt: row.created_at ? (row.created_at as { value: string }).value ?? String(row.created_at) : new Date().toISOString(),
      createdBy: String(row.created_by ?? ''),
      files: parseFilesRecord(row.files as Array<Record<string, unknown>> | undefined),
    }));
  } catch (error) {
    console.error('Failed to fetch election events:', error);
    return [];
  }
}

/** Fetches a single election event by its ID, or null if not found. */
export async function getElectionEvent(id: string): Promise<ElectionEvent | null> {
  try {
    await ensureSchema();
    const query = `SELECT * FROM ${table('election_events')} WHERE id = @id LIMIT 1`;
    const [rows] = await bq.query({ query, params: { id } });

    if ((rows as unknown[]).length === 0) return null;

    const row = (rows as Record<string, unknown>[])[0];
    return {
      id: String(row.id ?? ''),
      date: String(row.date ?? ''),
      electionType: String(row.election_type ?? ''),
      electionName: String(row.election_name ?? ''),
      electionAuthorityName: String(row.election_authority_name ?? ''),
      electionAuthorityType: String(row.election_authority_type ?? ''),
      createdAt: row.created_at ? (row.created_at as { value: string }).value ?? String(row.created_at) : new Date().toISOString(),
      createdBy: String(row.created_by ?? ''),
      files: parseFilesRecord(row.files as Array<Record<string, unknown>> | undefined),
    };
  } catch (error) {
    console.error('Failed to fetch election event:', error);
    return null;
  }
}

/** Updates the upload status of one file type within an election event. */
async function updateElectionEventFileStatus(
  electionEventId: string,
  fileType: string,
  status: ElectionEventFileStatus,
): Promise<void> {
  try {
    await ensureSchema();

    // Fetch the current event to get existing files
    const current = await getElectionEvent(electionEventId);
    if (!current) return;

    // Update the specific file type
    const updatedFiles = { ...current.files, [fileType]: status };

    // BigQuery DML UPDATE replaces the entire files array
    const query = `UPDATE ${table('election_events')} SET files = @files WHERE id = @id`;
    await bq.query({
      query,
      params: {
        id: electionEventId,
        files: serializeFilesRecord(updatedFiles),
      },
      types: {
        files: [
          {
            file_type: 'STRING',
            uploaded: 'BOOL',
            file_name: 'STRING',
            uploaded_at: 'STRING',
            uploaded_by: 'STRING',
            version: 'INT64',
            gcs_path: 'STRING',
          },
        ],
      },
    });
  } catch (error) {
    console.error('Failed to update election event file status:', error);
  }
}

// ---------------------------------------------------------------------------
// Delete Election Event
// ---------------------------------------------------------------------------

/** Deletes an election event and deactivates all related file versions. */
export async function deleteElectionEvent(
  id: string,
): Promise<{ success: boolean; message: string }> {
  try {
    await ensureSchema();

    // Verify the event exists before attempting to delete
    const event = await getElectionEvent(id);
    if (!event) {
      return {
        success: false,
        message: 'The election event could not be found. It may have already been deleted.',
      };
    }

    // Delete the election event from BigQuery
    const query = `DELETE FROM ${table('election_events')} WHERE id = @id`;
    await bq.query({ query, params: { id } });

    // Also clean up related file versions (mark as inactive)
    const deactivateQuery = `UPDATE ${table('file_versions')} SET is_active = FALSE WHERE election_event_id = @eventId`;
    await bq.query({ query: deactivateQuery, params: { eventId: id } });

    return {
      success: true,
      message: `Election event "${event.electionName}" has been deleted.`,
    };
  } catch (error: unknown) {
    console.error('Failed to delete election event:', error);
    return {
      success: false,
      message: 'Something went wrong while deleting the election event. Please try again.',
    };
  }
}

// ---------------------------------------------------------------------------
// No Elections Certifications
// ---------------------------------------------------------------------------

/** Records a "no elections" certification for a given year and authority, checking for duplicates. */
export async function certifyNoElections(data: {
  year: number;
  electionAuthorityName: string;
  electionAuthorityType: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = certifyNoElectionsSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, message: 'Invalid input. Please check your entries and try again.' };
    }
    data = parsed.data;

    await ensureSchema();

    // Check for existing certification for this year + authority
    const dupQuery = `SELECT id FROM ${table('no_elections_certifications')} WHERE year = @year AND election_authority_name = @authority LIMIT 1`;
    const [dupRows] = await bq.query({
      query: dupQuery,
      params: { year: data.year, authority: data.electionAuthorityName },
    });

    if ((dupRows as unknown[]).length > 0) {
      return {
        success: false,
        message: `A "No Elections" certification for ${data.year} already exists for your authority.`,
      };
    }

    const row = {
      id: randomUUID(),
      year: data.year,
      election_authority_name: data.electionAuthorityName,
      election_authority_type: data.electionAuthorityType,
      certified_at: new Date().toISOString(),
      certified_by: CURRENT_USER,
    };
    await bq.dataset(DATASET).table('no_elections_certifications').insert([row]);

    return {
      success: true,
      message: `Your authority has been certified as having no elections in ${data.year}.`,
    };
  } catch (error) {
    console.error('Failed to certify no elections:', error);
    return {
      success: false,
      message: 'Something went wrong while saving the certification. Please try again.',
    };
  }
}

/** Fetches all no-elections certifications for an authority. */
export async function getNoElectionsCertifications(
  electionAuthorityName: string,
): Promise<NoElectionsCertification[]> {
  try {
    await ensureSchema();
    const query = `SELECT * FROM ${table('no_elections_certifications')} WHERE election_authority_name = @authority ORDER BY certified_at DESC`;
    const [rows] = await bq.query({
      query,
      params: { authority: electionAuthorityName },
    });

    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id ?? ''),
      year: Number(row.year ?? 0),
      electionAuthorityName: String(row.election_authority_name ?? ''),
      electionAuthorityType: String(row.election_authority_type ?? ''),
      certifiedAt: row.certified_at ? (row.certified_at as { value: string }).value ?? String(row.certified_at) : new Date().toISOString(),
      certifiedBy: String(row.certified_by ?? ''),
    }));
  } catch (error) {
    console.error('Failed to fetch no-elections certifications:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// File Attestations
// ---------------------------------------------------------------------------

/** Attestation types for file requirements that can be satisfied without upload. */
export type AttestationType = "no-change" | "state-geo-accurate";

export interface FileAttestation {
  id: string;
  electionEventId: string;
  fileType: string;
  attestationType: AttestationType;
  electionAuthorityName: string;
  electionAuthorityType: string;
  attestedAt: string;
  attestedBy: string;
}

/**
 * Checks whether an authority is eligible to attest for a given file type
 * instead of uploading a new file.
 *
 * - poll-sites "no-change": requires a prior poll-sites upload for any other event
 * - district-maps "no-change": requires a prior district-maps upload OR a prior
 *   "state-geo-accurate" attestation for any other event
 * - district-maps "state-geo-accurate": always eligible (no prior submission needed)
 */
export async function checkAttestationEligibility(
  fileType: string,
  attestationType: AttestationType,
  electionAuthorityName: string,
  currentElectionEventId: string,
): Promise<{ eligible: boolean }> {
  try {
    await ensureSchema();

    // State GEO accuracy attestation is always available
    if (fileType === "district-maps" && attestationType === "state-geo-accurate") {
      return { eligible: true };
    }

    if (fileType === "poll-sites" && attestationType === "no-change") {
      // Check if authority has a previous poll-sites upload for another event
      const query = `
        SELECT 1 FROM ${table('election_events')} e,
        UNNEST(e.files) AS f
        WHERE e.election_authority_name = @authority
          AND e.id != @currentEventId
          AND f.file_type = 'poll-sites'
          AND f.uploaded = TRUE
        LIMIT 1
      `;
      const [rows] = await bq.query({
        query,
        params: { authority: electionAuthorityName, currentEventId: currentElectionEventId },
      });
      return { eligible: (rows as unknown[]).length > 0 };
    }

    if (fileType === "district-maps" && attestationType === "no-change") {
      // Check if authority has a previous district-maps upload for another event
      const uploadQuery = `
        SELECT 1 FROM ${table('election_events')} e,
        UNNEST(e.files) AS f
        WHERE e.election_authority_name = @authority
          AND e.id != @currentEventId
          AND f.file_type = 'district-maps'
          AND f.uploaded = TRUE
        LIMIT 1
      `;
      const [uploadRows] = await bq.query({
        query: uploadQuery,
        params: { authority: electionAuthorityName, currentEventId: currentElectionEventId },
      });
      if ((uploadRows as unknown[]).length > 0) return { eligible: true };

      // Check if authority has a previous state-geo-accurate attestation for another event
      const attestQuery = `
        SELECT 1 FROM ${table('file_attestations')}
        WHERE election_authority_name = @authority
          AND election_event_id != @currentEventId
          AND file_type = 'district-maps'
          AND attestation_type = 'state-geo-accurate'
        LIMIT 1
      `;
      const [attestRows] = await bq.query({
        query: attestQuery,
        params: { authority: electionAuthorityName, currentEventId: currentElectionEventId },
      });
      return { eligible: (attestRows as unknown[]).length > 0 };
    }

    return { eligible: false };
  } catch (error) {
    console.error('Failed to check attestation eligibility:', error);
    return { eligible: false };
  }
}

/**
 * Records an attestation for a file type within an election event and marks
 * the file requirement as complete.
 */
export async function submitAttestation(data: {
  electionEventId: string;
  fileType: string;
  attestationType: AttestationType;
  electionAuthorityName: string;
  electionAuthorityType: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = submitAttestationSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, message: 'Invalid input. Please check your entries and try again.' };
    }
    data = parsed.data;

    await ensureSchema();

    const id = randomUUID();
    const now = new Date().toISOString();

    // Insert attestation record
    const row = {
      id,
      election_event_id: data.electionEventId,
      file_type: data.fileType,
      attestation_type: data.attestationType,
      election_authority_name: data.electionAuthorityName,
      election_authority_type: data.electionAuthorityType,
      attested_at: now,
      attested_by: CURRENT_USER,
    };
    await bq.dataset(DATASET).table('file_attestations').insert([row]);

    // Build a descriptive "file name" for the attestation
    const attestLabel =
      data.attestationType === "no-change"
        ? "Attested — No changes since previous election"
        : "Attested — State GEO maps are accurate";

    // Mark the file requirement as complete on the election event
    await updateElectionEventFileStatus(data.electionEventId, data.fileType, {
      uploaded: true,
      fileName: attestLabel,
      uploadedAt: now,
      uploadedBy: CURRENT_USER,
    });

    // Log the attestation in submission logs
    await logSubmission(
      attestLabel,
      data.fileType,
      true,
      `${data.fileType === "poll-sites" ? "Poll Sites" : "District Maps"} requirement satisfied via attestation.`,
      data.electionEventId,
    );

    const friendlyType = data.fileType === "poll-sites" ? "Poll Sites" : "District Maps";
    return {
      success: true,
      message: `${friendlyType} requirement has been satisfied via attestation.`,
    };
  } catch (error) {
    console.error('Failed to submit attestation:', error);
    return {
      success: false,
      message: 'Something went wrong while recording the attestation. Please try again.',
    };
  }
}

// ---------------------------------------------------------------------------
// CSV validation — user-friendly error messages
// ---------------------------------------------------------------------------

/** Convert internal type names to user-friendly labels. */
function friendlyTypeName(type: string): string {
  switch (type) {
    case "string":
      return "Text";
    case "number":
      return "Number";
    case "boolean":
      return "Yes/No (true or false)";
    case "date":
      return "Date (MM/DD/YYYY)";
    default:
      return type;
  }
}

/** Describe a value in user-friendly terms. */
function friendlyValue(value: string): string {
  if (value === "" || value === '""' || value === "''") {
    return "Blank (empty)";
  }
  return `"${value}"`;
}

/** Validates a cell value against a field schema's expected type (string, number, boolean, date). */
function validateType(value: string, fieldSchema: FieldSchema): boolean {
  const trimmedValue = value.trim();

  if (trimmedValue === '') {
    return fieldSchema.required === false;
  }

  switch (fieldSchema.type) {
    case "string":
      return true;
    case "number":
      return !isNaN(Number(trimmedValue));
    case "boolean": {
      const lowerValue = trimmedValue.toLowerCase();
      return lowerValue === 'true' || lowerValue === 'false';
    }
    case "date": {
      const dateRegex = /^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})$/;
      if (!dateRegex.test(trimmedValue)) {
        return false;
      }
      // Normalize 2-digit years to 4-digit (00-29 → 2000-2029, 30-99 → 1930-1999)
      const parts = trimmedValue.split("/");
      if (parts[2].length === 2) {
        const yy = parseInt(parts[2], 10);
        parts[2] = String(yy <= 29 ? 2000 + yy : 1900 + yy);
      }
      const date = new Date(`${parts[0]}/${parts[1]}/${parts[2]}`);
      return !isNaN(date.getTime());
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Upload logic
// ---------------------------------------------------------------------------

/** Core upload logic: validates the file (CSV schema or shapefile), uploads to GCS, and returns the result. */
async function performUpload(
  file: File,
  fileType: string,
): Promise<{ success: boolean; message: string; gcsPath?: string }> {
  const bucketName = process.env.GCS_BUCKET_NAME;

  if (!bucketName || bucketName === 'your-gcs-bucket-name-here') {
    return {
      success: false,
      message: 'The server is not properly configured for file storage. Please contact your administrator.',
    };
  }

  if (!file || file.size === 0) {
    return { success: false, message: 'No file was provided. Please select a file and try again.' };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { success: false, message: 'This file is too large. The maximum allowed size is 5 MB. Please reduce the file size and try again.' };
  }

  // District maps: accept .zip (shapefile) / .geojson / .json — convert to GeoJSON
  if (fileType === "district-maps") {
    const name = file.name.toLowerCase();
    const validExtension = name.endsWith('.zip') || name.endsWith('.geojson') || name.endsWith('.json');
    if (!validExtension) {
      return {
        success: false,
        message: 'This file type is not accepted for District Maps. Please upload a .zip file (containing shapefiles) or a .geojson file.',
      };
    }

    try {
      const storage = new Storage();
      const buffer = Buffer.from(await file.arrayBuffer());
      const timestamp = Date.now();

      let geojsonBuffer: Buffer;
      let geojsonFileName: string;
      let featureCount: number | undefined;

      if (name.endsWith('.zip')) {
        // Convert shapefile .zip → GeoJSON
        const result = await convertShapefileToGeoJSON(buffer);
        if (!result.success || !result.geojson) {
          return { success: false, message: result.message };
        }

        const geojsonString = JSON.stringify(result.geojson);
        geojsonBuffer = Buffer.from(geojsonString, 'utf-8');
        geojsonFileName = file.name.replace(/\.zip$/i, '.geojson');
        featureCount = result.featureCount;

        // Also store the original .zip for reference
        const originalDest = `uploads/${fileType}/${timestamp}-${file.name}`;
        await storage.bucket(bucketName).file(originalDest).save(buffer);
      } else {
        // Validate and normalize uploaded .geojson / .json
        const result = validateGeoJSON(buffer);
        if (!result.success || !result.geojson) {
          return { success: false, message: result.message };
        }

        const geojsonString = JSON.stringify(result.geojson);
        geojsonBuffer = Buffer.from(geojsonString, 'utf-8');
        geojsonFileName = name.endsWith('.geojson') ? file.name : file.name.replace(/\.json$/i, '.geojson');
        featureCount = result.featureCount;
      }

      // Upload the GeoJSON to GCS
      const geojsonDest = `uploads/${fileType}/${timestamp}-${geojsonFileName}`;
      await storage.bucket(bucketName).file(geojsonDest).save(geojsonBuffer, {
        metadata: {
          contentType: 'application/geo+json',
          metadata: {
            'veda-file-type': fileType,
            'veda-upload-timestamp': new Date().toISOString(),
            'veda-scan-status': 'pending',
          },
        },
      });

      const countMsg = featureCount != null ? ` (${featureCount} feature${featureCount === 1 ? '' : 's'})` : '';
      return {
        success: true,
        message: name.endsWith('.zip')
          ? `${file.name} was converted to GeoJSON and uploaded successfully${countMsg}.`
          : `${file.name} has been uploaded successfully${countMsg}.`,
        gcsPath: geojsonDest,
      };
    } catch (error: unknown) {
      console.error('Error uploading to GCS:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Could not refresh access token')) {
        return {
          success: false,
          message: 'There was a temporary problem connecting to the file storage service. Please wait a moment and try again.',
        };
      }
      return {
        success: false,
        message: 'There was a problem uploading your file. Please try again. If the problem continues, contact your administrator.',
      };
    }
  }

  // CSV validation
  if (file.type !== 'text/csv') {
    return { success: false, message: 'This file is not a CSV. Please upload a .csv file.' };
  }

  const schema = fileSchemas[fileType];
  if (!schema) {
    return { success: false, message: `We don't recognize this file type ("${fileType}"). Please try a different upload option.` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileContent = buffer.toString('utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');

  if (lines.length < 2) {
    return { success: false, message: 'This CSV file appears to be empty. It must contain a header row and at least one row of data.' };
  }

  // Header validation
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const expectedHeaders = schema.map(s => s.name);
  if (headers.length !== expectedHeaders.length || !headers.every((h, i) => h === expectedHeaders[i])) {
    const missing = expectedHeaders.filter(h => !headers.includes(h));
    const extra = headers.filter(h => !expectedHeaders.includes(h));
    let errorMessage = 'The column headers in your file do not match what is expected.';
    if (missing.length > 0) {
      errorMessage += `\n\nMissing columns: ${missing.join(', ')}`;
    }
    if (extra.length > 0) {
      errorMessage += `\n\nUnexpected columns: ${extra.join(', ')}`;
    }
    errorMessage += `\n\nPlease check that your file has the correct columns in the right order.`;
    return { success: false, message: errorMessage };
  }

  // Row validation (first 5 data rows)
  const rowsToValidate = lines.slice(1, 6);
  for (let i = 0; i < rowsToValidate.length; i++) {
    const rowNumber = i + 2;
    const values = rowsToValidate[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

    if (values.length !== schema.length) {
      return {
        success: false,
        message: `Row ${rowNumber} has the wrong number of columns. We expected ${schema.length} columns but found ${values.length}. Please check that row for missing or extra commas.`,
      };
    }

    for (let j = 0; j < schema.length; j++) {
      const value = values[j];
      const fieldSchema = schema[j];
      if (!validateType(value, fieldSchema)) {
        const friendlyExpected = friendlyTypeName(fieldSchema.type);
        const friendlyActual = friendlyValue(value);

        if (value.trim() === '' && fieldSchema.required !== false) {
          return {
            success: false,
            message: `Row ${rowNumber}, column "${fieldSchema.name}": This field is required but was left blank. Please fill in a value.`,
          };
        }

        return {
          success: false,
          message: `Row ${rowNumber}, column "${fieldSchema.name}": Expected ${friendlyExpected} but found ${friendlyActual}. Please correct this value.`,
        };
      }
    }
  }

  try {
    const storage = new Storage();
    const destination = `uploads/${fileType}/${Date.now()}-${file.name}`;

    await storage.bucket(bucketName).file(destination).save(buffer, {
      metadata: {
        contentType: 'text/csv',
        metadata: {
          'veda-file-type': fileType,
          'veda-upload-timestamp': new Date().toISOString(),
          'veda-scan-status': 'pending',
        },
      },
    });

    const rowCount = lines.length - 1; // subtract header row
    const friendlyFileType = fileType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { success: true, message: `${friendlyFileType} successfully uploaded — ${rowCount} row${rowCount !== 1 ? 's' : ''}.`, gcsPath: destination };
  } catch (error: unknown) {
    console.error('Error uploading to GCS:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Could not refresh access token')) {
      return {
        success: false,
        message: 'There was a temporary problem connecting to the file storage service. Please wait a moment and try again.',
      };
    }

    return {
      success: false,
      message: 'There was a problem uploading your file. Please try again. If the problem continues, contact your administrator.',
    };
  }
}

// ---------------------------------------------------------------------------
// Public server action
// ---------------------------------------------------------------------------

/** Public server action entry point called by client components to upload a file. */
export async function uploadFile(formData: FormData): Promise<{ success: boolean; message: string }> {
  const file = formData.get('file') as File;
  const rawFileType = formData.get('fileType') as string;
  const rawElectionAuthorityName = formData.get('electionAuthorityName') as string | null;
  const rawElectionAuthorityType = formData.get('electionAuthorityType') as string | null;
  const rawAmendmentNotes = formData.get('amendmentNotes') as string | null;
  const rawElectionEventId = formData.get('electionEventId') as string | null;

  const parsed = uploadFileSchema.safeParse({
    fileType: rawFileType,
    electionAuthorityName: rawElectionAuthorityName || null,
    electionAuthorityType: rawElectionAuthorityType || null,
    amendmentNotes: rawAmendmentNotes || null,
    electionEventId: rawElectionEventId || null,
  });
  if (!parsed.success) {
    return { success: false, message: 'Invalid upload parameters. Please try again.' };
  }

  const { fileType, electionAuthorityName, electionAuthorityType, amendmentNotes, electionEventId } = parsed.data;

  // Sanitize filename: strip path traversal sequences and non-printable characters
  const fileName = (file?.name ?? 'unknown').replace(/\.\.[/\\]/g, '').replace(/[^\x20-\x7E]/g, '_');

  const result = await performUpload(file, fileType);

  // Persist to BigQuery — never blocks or fails the response
  await logSubmission(fileName, fileType, result.success, result.message, electionEventId ?? undefined);

  // Track file version on successful upload
  if (result.success && result.gcsPath && electionAuthorityName) {
    await createFileVersion(
      fileType,
      fileName,
      result.gcsPath,
      electionAuthorityName,
      electionAuthorityType || '',
      amendmentNotes || '',
      electionEventId || undefined,
    );

    // Update election event file status
    if (electionEventId) {
      await updateElectionEventFileStatus(electionEventId, fileType, {
        uploaded: true,
        fileName,
        uploadedAt: new Date().toISOString(),
        uploadedBy: CURRENT_USER,
        version: 1,
        gcsPath: result.gcsPath,
      });
    }
  }

  return result;
}
