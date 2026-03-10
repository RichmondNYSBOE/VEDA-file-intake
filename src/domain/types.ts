/**
 * @file Consolidated domain types for the VoteVault application.
 *
 * All shared interfaces and type aliases live here so that both server actions
 * and client components can import from a single canonical location.
 */

// ---------------------------------------------------------------------------
// Core domain types (previously in src/app/actions.ts)
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

// ---------------------------------------------------------------------------
// Re-exports from well-structured library files
// ---------------------------------------------------------------------------

export type { FieldType, FieldSchema } from "@/lib/file-schemas";
export type { ParsedData } from "@/lib/file-parser";
export type { MatchConfidence, SchemaFieldMatch, MatchResult } from "@/lib/header-matching";
export type { ElectionTypeOption, UploadStepFileType } from "@/lib/election-types";
