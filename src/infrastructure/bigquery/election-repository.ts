/**
 * @file Repository for election event BigQuery operations.
 *
 * Encapsulates all SQL queries and row-mapping logic for the `election_events`
 * table so that higher-level services never touch raw SQL.
 */

import type { ElectionEvent, ElectionEventFileStatus } from '@/domain/types';
import {
  bq,
  ensureSchema,
  table,
  DEFAULT_FILE_STATUS,
  FILE_TYPES,
  parseFilesRecord,
  serializeFilesRecord,
} from '@/infrastructure/bigquery/client';

/** Check if an election with this name exists for an authority. */
export async function findElectionByName(name: string, authority: string): Promise<boolean> {
  try {
    await ensureSchema();
    const dupQuery = `SELECT id FROM ${table('election_events')} WHERE election_name = @name AND election_authority_name = @authority LIMIT 1`;
    const [dupRows] = await bq.query({
      query: dupQuery,
      params: { name, authority },
    });
    return (dupRows as unknown[]).length > 0;
  } catch (error) {
    console.error('Failed to check for duplicate election event:', error);
    return false;
  }
}

/** Insert a new election event. */
export async function insertElectionEvent(params: {
  id: string;
  date: string;
  electionType: string;
  electionName: string;
  electionAuthorityName: string;
  electionAuthorityType: string;
  createdBy: string;
  files: Record<string, ElectionEventFileStatus>;
}): Promise<void> {
  try {
    await ensureSchema();
    const createdAt = new Date().toISOString();
    const filesParam = serializeFilesRecord(params.files);

    const query = `INSERT INTO ${table('election_events')} (id, date, election_type, election_name, election_authority_name, election_authority_type, created_at, created_by, files)
      VALUES (@id, @date, @electionType, @electionName, @authorityName, @authorityType, @createdAt, @createdBy, @files)`;

    await bq.query({
      query,
      params: {
        id: params.id,
        date: params.date,
        electionType: params.electionType,
        electionName: params.electionName,
        authorityName: params.electionAuthorityName,
        authorityType: params.electionAuthorityType,
        createdAt,
        createdBy: params.createdBy,
        files: filesParam,
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
    console.error('Failed to insert election event:', error);
    throw error;
  }
}

/** Fetch all election events for an authority. */
export async function fetchElectionEvents(electionAuthorityName: string): Promise<ElectionEvent[]> {
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

/** Fetch a single election event by ID. */
export async function fetchElectionEvent(id: string): Promise<ElectionEvent | null> {
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

/** Update the files array on an election event. */
export async function updateElectionFiles(
  id: string,
  files: Record<string, ElectionEventFileStatus>,
): Promise<void> {
  await ensureSchema();
  const query = `UPDATE ${table('election_events')} SET files = @files WHERE id = @id`;
  await bq.query({
    query,
    params: {
      id,
      files: serializeFilesRecord(files),
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
}

/** Delete an election event by ID. */
export async function deleteElectionEventById(id: string): Promise<void> {
  try {
    await ensureSchema();
    const query = `DELETE FROM ${table('election_events')} WHERE id = @id`;
    await bq.query({ query, params: { id } });
  } catch (error) {
    console.error('Failed to delete election event:', error);
    throw error;
  }
}
