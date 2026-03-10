/**
 * @file Repository for no-elections certification BigQuery operations.
 *
 * Encapsulates all SQL queries and row-mapping logic for the
 * `no_elections_certifications` table.
 */

import { randomUUID } from 'crypto';
import type { NoElectionsCertification } from '@/domain/types';
import { bq, DATASET, ensureSchema, table } from '@/infrastructure/bigquery/client';

/** Check if certification already exists for year + authority. */
export async function findCertification(year: number, authority: string): Promise<boolean> {
  try {
    await ensureSchema();
    const dupQuery = `SELECT id FROM ${table('no_elections_certifications')} WHERE year = @year AND election_authority_name = @authority LIMIT 1`;
    const [dupRows] = await bq.query({
      query: dupQuery,
      params: { year, authority },
    });
    return (dupRows as unknown[]).length > 0;
  } catch (error) {
    console.error('Failed to check for existing certification:', error);
    return false;
  }
}

/** Insert a no-elections certification. */
export async function insertCertification(params: {
  year: number;
  electionAuthorityName: string;
  electionAuthorityType: string;
  certifiedBy: string;
}): Promise<void> {
  try {
    await ensureSchema();
    const row = {
      id: randomUUID(),
      year: params.year,
      election_authority_name: params.electionAuthorityName,
      election_authority_type: params.electionAuthorityType,
      certified_at: new Date().toISOString(),
      certified_by: params.certifiedBy,
    };
    await bq.dataset(DATASET).table('no_elections_certifications').insert([row]);
  } catch (error) {
    console.error('Failed to insert certification:', error);
    throw error;
  }
}

/** Fetch all certifications for an authority. */
export async function fetchCertifications(electionAuthorityName: string): Promise<NoElectionsCertification[]> {
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
