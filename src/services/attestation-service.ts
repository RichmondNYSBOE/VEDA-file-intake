/**
 * @file Attestation service — orchestrates attestation eligibility checks
 * and attestation submission.
 *
 * Delegates to infrastructure repositories for persistence and domain rules
 * for eligibility logic. All functions catch errors internally and return
 * structured results (never throw).
 */

import { isAlwaysEligible } from '@/domain/election/attestation-rules';
import {
  hasPriorUpload,
  hasPriorAttestation,
  insertAttestation,
} from '@/infrastructure/bigquery/attestation-repository';
import { CURRENT_USER } from '@/infrastructure/bigquery/client';
import { updateElectionEventFileStatus } from '@/services/election-service';
import { logSubmission } from '@/services/audit-service';
import type { AttestationType } from '@/domain/types';
import { validationMessages } from '@/content/validation-messages';

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/** Check if authority can attest for a file type. */
export async function checkAttestationEligibility(
  fileType: string,
  attestationType: AttestationType,
  electionAuthorityName: string,
  currentElectionEventId: string,
): Promise<{ eligible: boolean }> {
  try {
    // Domain rule: some attestations are always eligible
    if (isAlwaysEligible(fileType, attestationType)) {
      return { eligible: true };
    }

    if (fileType === 'poll-sites' && attestationType === 'no-change') {
      // Requires a prior poll-sites upload for any other event
      const hasUpload = await hasPriorUpload(fileType, electionAuthorityName, currentElectionEventId);
      return { eligible: hasUpload };
    }

    if (fileType === 'district-maps' && attestationType === 'no-change') {
      // Requires a prior district-maps upload OR a prior state-geo-accurate attestation
      const hasUpload = await hasPriorUpload(fileType, electionAuthorityName, currentElectionEventId);
      if (hasUpload) return { eligible: true };

      const hasAttest = await hasPriorAttestation(
        fileType,
        'state-geo-accurate',
        electionAuthorityName,
        currentElectionEventId,
      );
      return { eligible: hasAttest };
    }

    return { eligible: false };
  } catch (error) {
    console.error('Failed to check attestation eligibility:', error);
    return { eligible: false };
  }
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

/** Submit an attestation (records it, updates event status, logs submission). */
export async function submitAttestation(data: {
  electionEventId: string;
  fileType: string;
  attestationType: AttestationType;
  electionAuthorityName: string;
  electionAuthorityType: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const now = new Date().toISOString();

    // 1. Insert attestation record
    await insertAttestation({
      electionEventId: data.electionEventId,
      fileType: data.fileType,
      attestationType: data.attestationType,
      electionAuthorityName: data.electionAuthorityName,
      electionAuthorityType: data.electionAuthorityType,
      attestedBy: CURRENT_USER,
    });

    // 2. Build descriptive label
    const attestLabel =
      data.attestationType === 'no-change'
        ? validationMessages.attestations.noChangeLabel
        : validationMessages.attestations.stateGeoLabel;

    // 3. Update election event file status
    await updateElectionEventFileStatus(data.electionEventId, data.fileType, {
      uploaded: true,
      fileName: attestLabel,
      uploadedAt: now,
      uploadedBy: CURRENT_USER,
    });

    // 4. Log submission
    const friendlyType = data.fileType === 'poll-sites' ? 'Poll Sites' : 'District Maps';
    await logSubmission(
      attestLabel,
      data.fileType,
      true,
      validationMessages.attestations.logMessage(friendlyType),
      data.electionEventId,
    );

    return {
      success: true,
      message: validationMessages.attestations.successMessage(friendlyType),
    };
  } catch (error) {
    console.error('Failed to submit attestation:', error);
    return {
      success: false,
      message: validationMessages.attestations.error,
    };
  }
}
