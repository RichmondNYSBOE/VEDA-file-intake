/**
 * @file Re-export barrel for election naming and configuration utilities.
 *
 * These functions and constants already live in well-structured library files;
 * this module provides a domain-level entry point for consumers.
 */

export {
  deriveElectionName,
  getElectionTypesForAuthority,
  ELECTION_TYPES_BY_CATEGORY,
  UPLOAD_STEPS,
} from "@/lib/election-types";

export type { ElectionTypeOption, UploadStepFileType } from "@/lib/election-types";
