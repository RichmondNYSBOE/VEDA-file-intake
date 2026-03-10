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
import { validationMessages } from '@/content/validation-messages';

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
        message: validationMessages.certifications.duplicate(data.year),
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
      message: validationMessages.certifications.success(data.year),
    };
  } catch (error) {
    console.error('Failed to certify no elections:', error);
    return {
      success: false,
      message: validationMessages.certifications.error,
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
