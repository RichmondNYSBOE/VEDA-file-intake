/**
 * @file Repository for file attestation BigQuery operations.
 *
 * Encapsulates all SQL queries and row-mapping logic for the
 * `file_attestations` table and related eligibility checks against
 * `election_events`.
 */

import { randomUUID } from 'crypto';
import type { AttestationType } from '@/domain/types';
import { bq, DATASET, ensureSchema, table } from '@/infrastructure/bigquery/client';

/**
 * Check if authority has a prior upload of a file type (excluding current event).
 *
 * Looks at the `election_events.files` REPEATED field for an `uploaded = TRUE`
 * record matching the given file type for a different event.
 */
export async function hasPriorUpload(
  fileType: string,
  electionAuthorityName: string,
  excludeEventId: string,
): Promise<boolean> {
  try {
    await ensureSchema();
    const query = `
      SELECT 1 FROM ${table('election_events')} e,
      UNNEST(e.files) AS f
      WHERE e.election_authority_name = @authority
        AND e.id != @currentEventId
        AND f.file_type = @fileType
        AND f.uploaded = TRUE
      LIMIT 1
    `;
    const [rows] = await bq.query({
      query,
      params: { authority: electionAuthorityName, currentEventId: excludeEventId, fileType },
    });
    return (rows as unknown[]).length > 0;
  } catch (error) {
    console.error('Failed to check for prior upload:', error);
    return false;
  }
}

/**
 * Check if authority has a prior attestation of a specific type
 * (excluding current event).
 */
export async function hasPriorAttestation(
  fileType: string,
  attestationType: AttestationType,
  electionAuthorityName: string,
  excludeEventId: string,
): Promise<boolean> {
  try {
    await ensureSchema();
    const query = `
      SELECT 1 FROM ${table('file_attestations')}
      WHERE election_authority_name = @authority
        AND election_event_id != @currentEventId
        AND file_type = @fileType
        AND attestation_type = @attestationType
      LIMIT 1
    `;
    const [rows] = await bq.query({
      query,
      params: {
        authority: electionAuthorityName,
        currentEventId: excludeEventId,
        fileType,
        attestationType,
      },
    });
    return (rows as unknown[]).length > 0;
  } catch (error) {
    console.error('Failed to check for prior attestation:', error);
    return false;
  }
}

/** Insert an attestation record. */
export async function insertAttestation(params: {
  electionEventId: string;
  fileType: string;
  attestationType: AttestationType;
  electionAuthorityName: string;
  electionAuthorityType: string;
  attestedBy: string;
}): Promise<void> {
  try {
    await ensureSchema();
    const row = {
      id: randomUUID(),
      election_event_id: params.electionEventId,
      file_type: params.fileType,
      attestation_type: params.attestationType,
      election_authority_name: params.electionAuthorityName,
      election_authority_type: params.electionAuthorityType,
      attested_at: new Date().toISOString(),
      attested_by: params.attestedBy,
    };
    await bq.dataset(DATASET).table('file_attestations').insert([row]);
  } catch (error) {
    console.error('Failed to insert attestation:', error);
    throw error;
  }
}
