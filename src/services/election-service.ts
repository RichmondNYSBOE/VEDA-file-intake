/**
 * @file Election service — orchestrates election event CRUD operations.
 *
 * Delegates to infrastructure repositories for persistence. All functions
 * catch errors internally and return structured results (never throw).
 */

import { randomUUID } from 'crypto';

import {
  findElectionByName,
  insertElectionEvent,
  fetchElectionEvents,
  fetchElectionEvent,
  updateElectionFiles,
  deleteElectionEventById,
} from '@/infrastructure/bigquery/election-repository';
import { deactivateFileVersionsByEvent } from '@/infrastructure/bigquery/submission-repository';
import { CURRENT_USER, DEFAULT_FILE_STATUS, FILE_TYPES } from '@/infrastructure/bigquery/client';
import type { ElectionEvent, ElectionEventFileStatus } from '@/domain/types';
import { validationMessages } from '@/content/validation-messages';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** Create an election event (checks for duplicates). */
export async function createElectionEvent(data: {
  date: string;
  electionType: string;
  electionName: string;
  electionAuthorityName: string;
  electionAuthorityType: string;
}): Promise<{ success: boolean; message: string; id?: string }> {
  try {
    // Check for duplicate election events
    const exists = await findElectionByName(data.electionName, data.electionAuthorityName);
    if (exists) {
      return {
        success: false,
        message: validationMessages.electionEvents.duplicateEvent(data.electionName),
      };
    }

    const id = randomUUID();

    // Build default files record
    const defaultFiles: Record<string, ElectionEventFileStatus> = {};
    for (const ft of FILE_TYPES) {
      defaultFiles[ft] = { ...DEFAULT_FILE_STATUS };
    }

    await insertElectionEvent({
      id,
      date: data.date,
      electionType: data.electionType,
      electionName: data.electionName,
      electionAuthorityName: data.electionAuthorityName,
      electionAuthorityType: data.electionAuthorityType,
      createdBy: CURRENT_USER,
      files: defaultFiles,
    });

    return {
      success: true,
      message: validationMessages.electionEvents.created(data.electionName),
      id,
    };
  } catch (error: unknown) {
    console.error('Failed to create election event:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: validationMessages.electionEvents.createFailed(detail),
    };
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Get all election events for an authority. */
export async function getElectionEvents(
  electionAuthorityName: string,
): Promise<ElectionEvent[]> {
  try {
    return await fetchElectionEvents(electionAuthorityName);
  } catch (error) {
    console.error('Failed to fetch election events:', error);
    return [];
  }
}

/** Get a single election event by ID. */
export async function getElectionEvent(
  id: string,
): Promise<ElectionEvent | null> {
  try {
    return await fetchElectionEvent(id);
  } catch (error) {
    console.error('Failed to fetch election event:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/** Update file status within an election event. Throws on failure. */
export async function updateElectionEventFileStatus(
  electionEventId: string,
  fileType: string,
  status: ElectionEventFileStatus,
): Promise<void> {
  const current = await fetchElectionEvent(electionEventId);
  if (!current) {
    throw new Error(`Election event ${electionEventId} not found`);
  }

  // Merge the updated file status
  const updatedFiles = { ...current.files, [fileType]: status };

  await updateElectionFiles(electionEventId, updatedFiles);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** Delete an election event (also deactivates related file versions). */
export async function deleteElectionEvent(
  id: string,
): Promise<{ success: boolean; message: string }> {
  try {
    // Verify the event exists before attempting to delete
    const event = await fetchElectionEvent(id);
    if (!event) {
      return {
        success: false,
        message: validationMessages.electionEvents.notFound,
      };
    }

    // Delete the election event
    await deleteElectionEventById(id);

    // Deactivate related file versions
    await deactivateFileVersionsByEvent(id);

    return {
      success: true,
      message: validationMessages.electionEvents.deleted(event.electionName),
    };
  } catch (error: unknown) {
    console.error('Failed to delete election event:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: validationMessages.electionEvents.deleteFailed(detail),
    };
  }
}
