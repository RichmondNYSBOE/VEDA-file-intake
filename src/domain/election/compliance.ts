/**
 * @file Election compliance status logic.
 *
 * Determines whether an election event has all required files uploaded,
 * is partially complete, or has not been started.
 */

import { UPLOAD_STEPS } from "@/lib/election-types";
import type { ElectionEvent } from "@/domain/types";

/** Compliance status of an election event based on file upload progress. */
export type ComplianceStatus = "complete" | "in-progress" | "not-started";

/** Determine the compliance status of an election event based on its uploaded files. */
export function getComplianceStatus(event: ElectionEvent): ComplianceStatus {
  const fileTypes = UPLOAD_STEPS.map((s) => s.fileType);
  const uploadedCount = fileTypes.filter(
    (ft) => event.files[ft]?.uploaded,
  ).length;

  if (uploadedCount === fileTypes.length) return "complete";
  if (uploadedCount > 0) return "in-progress";
  return "not-started";
}
