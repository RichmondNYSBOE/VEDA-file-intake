/**
 * @file Audit service — orchestrates submission logging and file versioning.
 *
 * Delegates to infrastructure repositories for persistence. All functions
 * catch errors internally and never throw to the caller.
 */

import {
  insertSubmissionLog,
  fetchSubmissionLogs,
  insertFileVersion,
  fetchFileVersions,
  fetchActiveFileVersions,
} from '@/infrastructure/bigquery/submission-repository';
import { CURRENT_USER } from '@/infrastructure/bigquery/client';
import type { SubmissionLogEntry, FileVersionEntry } from '@/domain/types';

// ---------------------------------------------------------------------------
// Submission logs
// ---------------------------------------------------------------------------

/** Log a submission and return void (never throws). */
export async function logSubmission(
  fileName: string,
  fileType: string,
  success: boolean,
  message: string,
  electionEventId?: string,
): Promise<void> {
  try {
    await insertSubmissionLog({
      fileName,
      fileType,
      success,
      message,
      uploadedBy: CURRENT_USER,
      electionEventId,
    });
  } catch (error) {
    console.error('Failed to log submission:', error);
  }
}

/** Get submission logs, optionally filtered by event. */
export async function getSubmissionLogs(
  electionEventId?: string,
): Promise<SubmissionLogEntry[]> {
  try {
    return await fetchSubmissionLogs(electionEventId);
  } catch (error) {
    console.error('Failed to fetch submission logs:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// File versioning
// ---------------------------------------------------------------------------

/** Create a file version record (handles deactivation of prior versions). */
export async function createFileVersion(
  fileType: string,
  fileName: string,
  gcsPath: string,
  electionAuthorityName: string,
  electionAuthorityType: string,
  amendmentNotes: string,
  electionEventId?: string,
): Promise<void> {
  try {
    await insertFileVersion({
      fileType,
      fileName,
      gcsPath,
      electionAuthorityName,
      electionAuthorityType,
      amendmentNotes,
      uploadedBy: CURRENT_USER,
      electionEventId,
    });
  } catch (error) {
    console.error('Failed to create file version record:', error);
  }
}

/** Get all versions of a file type for an authority. */
export async function getFileVersions(
  fileType: string,
  electionAuthorityName: string,
): Promise<FileVersionEntry[]> {
  try {
    return await fetchFileVersions(fileType, electionAuthorityName);
  } catch (error) {
    console.error('Failed to fetch file versions:', error);
    return [];
  }
}

/** Get active file versions for an authority. */
export async function getAllFileVersions(
  electionAuthorityName: string,
): Promise<FileVersionEntry[]> {
  try {
    return await fetchActiveFileVersions(electionAuthorityName);
  } catch (error) {
    console.error('Failed to fetch active file versions:', error);
    return [];
  }
}
