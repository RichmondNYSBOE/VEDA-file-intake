/**
 * @file Server actions — thin routing layer.
 *
 * Each exported function is a Next.js server action callable from client
 * components.  Business logic lives in src/services/, data access in
 * src/infrastructure/, and domain rules in src/domain/.
 *
 * This file only extracts parameters, delegates to the appropriate service,
 * and returns the result.
 */

'use server'

import type { AttestationType } from '@/domain/types';

// Re-export domain types so existing component imports (`from '@/app/actions'`)
// continue to work without modification.
export type {
  SubmissionLogEntry,
  FileVersionEntry,
  ElectionEventFileStatus,
  ElectionEvent,
  NoElectionsCertification,
  AttestationType,
  FileAttestation,
} from '@/domain/types';

import * as auditService from '@/services/audit-service';
import * as electionService from '@/services/election-service';
import * as certificationService from '@/services/certification-service';
import * as attestationService from '@/services/attestation-service';
import * as uploadService from '@/services/upload-service';

// ---------------------------------------------------------------------------
// Audit / Submission logs
// ---------------------------------------------------------------------------

export async function getSubmissionLogs(electionEventId?: string) {
  return auditService.getSubmissionLogs(electionEventId);
}

export async function getFileVersions(fileType: string, electionAuthorityName: string) {
  return auditService.getFileVersions(fileType, electionAuthorityName);
}

export async function getAllFileVersions(electionAuthorityName: string) {
  return auditService.getAllFileVersions(electionAuthorityName);
}

// ---------------------------------------------------------------------------
// Election events
// ---------------------------------------------------------------------------

export async function createElectionEvent(data: {
  date: string;
  electionType: string;
  electionName: string;
  electionAuthorityName: string;
  electionAuthorityType: string;
}) {
  return electionService.createElectionEvent(data);
}

export async function getElectionEvents(electionAuthorityName: string) {
  return electionService.getElectionEvents(electionAuthorityName);
}

export async function getElectionEvent(id: string) {
  return electionService.getElectionEvent(id);
}

export async function deleteElectionEvent(id: string) {
  return electionService.deleteElectionEvent(id);
}

// ---------------------------------------------------------------------------
// No-elections certifications
// ---------------------------------------------------------------------------

export async function certifyNoElections(data: {
  year: number;
  electionAuthorityName: string;
  electionAuthorityType: string;
}) {
  return certificationService.certifyNoElections(data);
}

export async function getNoElectionsCertifications(electionAuthorityName: string) {
  return certificationService.getNoElectionsCertifications(electionAuthorityName);
}

// ---------------------------------------------------------------------------
// File attestations
// ---------------------------------------------------------------------------

export async function checkAttestationEligibility(
  fileType: string,
  attestationType: AttestationType,
  electionAuthorityName: string,
  currentElectionEventId: string,
) {
  return attestationService.checkAttestationEligibility(
    fileType, attestationType, electionAuthorityName, currentElectionEventId,
  );
}

export async function submitAttestation(data: {
  electionEventId: string;
  fileType: string;
  attestationType: AttestationType;
  electionAuthorityName: string;
  electionAuthorityType: string;
}) {
  return attestationService.submitAttestation(data);
}

// ---------------------------------------------------------------------------
// File upload
// ---------------------------------------------------------------------------

export async function uploadFile(formData: FormData) {
  const file = formData.get('file') as File;
  const fileType = formData.get('fileType') as string;
  const electionAuthorityName = formData.get('electionAuthorityName') as string | null;
  const electionAuthorityType = formData.get('electionAuthorityType') as string | null;
  const amendmentNotes = formData.get('amendmentNotes') as string | null;
  const electionEventId = formData.get('electionEventId') as string | null;

  return uploadService.uploadFile({
    file,
    fileType,
    electionAuthorityName: electionAuthorityName ?? undefined,
    electionAuthorityType: electionAuthorityType ?? undefined,
    amendmentNotes: amendmentNotes ?? undefined,
    electionEventId: electionEventId ?? undefined,
  });
}

// ---------------------------------------------------------------------------
// Signed-URL upload (large files — browser uploads directly to GCS)
// ---------------------------------------------------------------------------

export async function getSignedUploadUrl(formData: FormData) {
  const fileType = formData.get('fileType') as string;
  const fileName = formData.get('fileName') as string;
  const contentType = formData.get('contentType') as string;
  const fileSize = Number(formData.get('fileSize'));

  return uploadService.requestSignedUrl({ fileType, fileName, contentType, fileSize });
}

export async function confirmUpload(formData: FormData) {
  const destination = formData.get('destination') as string;
  const fileType = formData.get('fileType') as string;
  const fileName = formData.get('fileName') as string;
  const fileSize = Number(formData.get('fileSize'));
  const electionAuthorityName = formData.get('electionAuthorityName') as string | null;
  const electionAuthorityType = formData.get('electionAuthorityType') as string | null;
  const amendmentNotes = formData.get('amendmentNotes') as string | null;
  const electionEventId = formData.get('electionEventId') as string | null;

  return uploadService.confirmFileUpload({
    destination,
    fileType,
    fileName,
    fileSize,
    electionAuthorityName: electionAuthorityName ?? undefined,
    electionAuthorityType: electionAuthorityType ?? undefined,
    amendmentNotes: amendmentNotes ?? undefined,
    electionEventId: electionEventId ?? undefined,
  });
}
