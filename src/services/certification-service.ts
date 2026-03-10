/**
 * @file Certification service — orchestrates no-elections certifications.
 *
 * Delegates to infrastructure repositories for persistence. All functions
 * catch errors internally and return structured results (never throw).
 */

import {
  findCertification,
  insertCertification,
  fetchCertifications,
} from '@/infrastructure/bigquery/certification-repository';
import { CURRENT_USER } from '@/infrastructure/bigquery/client';
import type { NoElectionsCertification } from '@/domain/types';

// ---------------------------------------------------------------------------
// Certify
// ---------------------------------------------------------------------------

/** Certify no elections for a year (checks for duplicates). */
export async function certifyNoElections(data: {
  year: number;
  electionAuthorityName: string;
  electionAuthorityType: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    // Check for existing certification for this year + authority
    const exists = await findCertification(data.year, data.electionAuthorityName);
    if (exists) {
      return {
        success: false,
        message: `A "No Elections" certification for ${data.year} already exists for your authority.`,
      };
    }

    await insertCertification({
      year: data.year,
      electionAuthorityName: data.electionAuthorityName,
      electionAuthorityType: data.electionAuthorityType,
      certifiedBy: CURRENT_USER,
    });

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

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Get all certifications for an authority. */
export async function getNoElectionsCertifications(
  electionAuthorityName: string,
): Promise<NoElectionsCertification[]> {
  try {
    return await fetchCertifications(electionAuthorityName);
  } catch (error) {
    console.error('Failed to fetch no-elections certifications:', error);
    return [];
  }
}
