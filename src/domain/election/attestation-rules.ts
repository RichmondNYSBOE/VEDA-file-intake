/**
 * @file Pure business rules for file attestation eligibility.
 *
 * These functions encode which attestation types are available for each file
 * type and whether an attestation can be granted without prior data. They
 * contain no infrastructure dependencies — the actual data lookups live in
 * the server actions layer.
 */

import type { AttestationType } from "@/domain/types";

/**
 * Return the attestation types available for a given file type.
 *
 * - poll-sites: "no-change" only
 * - district-maps: "no-change" and "state-geo-accurate"
 * - all others: none
 */
export function getAvailableAttestationTypes(fileType: string): AttestationType[] {
  switch (fileType) {
    case "poll-sites":
      return ["no-change"];
    case "district-maps":
      return ["no-change", "state-geo-accurate"];
    default:
      return [];
  }
}

/**
 * Whether an attestation of the given type for the given file type is always
 * eligible — i.e., it does not require a prior upload or attestation.
 *
 * Currently only district-maps + state-geo-accurate is always eligible.
 */
export function isAlwaysEligible(fileType: string, attestationType: AttestationType): boolean {
  return fileType === "district-maps" && attestationType === "state-geo-accurate";
}
