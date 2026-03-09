/**
 * @file Election type definitions, authority-to-category mappings, election name
 * derivation logic, and the upload wizard step configuration.
 */

export interface ElectionTypeOption {
  value: string;
  label: string;
}

/**
 * Election types grouped by authority category.
 */
export const ELECTION_TYPES_BY_CATEGORY: Record<string, ElectionTypeOption[]> = {
  "County Board of Elections": [
    { value: "Primary", label: "Primary" },
    { value: "General", label: "General" },
    { value: "Special", label: "Special" },
  ],
  Village: [
    { value: "Primary", label: "Primary" },
    { value: "General", label: "General" },
    { value: "Special", label: "Special" },
  ],
  "School or Library": [
    { value: "Budget", label: "Budget" },
    { value: "Budget Revote", label: "Budget Revote" },
    { value: "School Board", label: "School Board" },
    { value: "Bond", label: "Bond" },
  ],
};

/**
 * Maps specific authority types to their election-type category.
 */
const AUTHORITY_TYPE_TO_CATEGORY: Record<string, string> = {
  "County Board of Elections": "County Board of Elections",
  Village: "Village",
  "Central School District": "School or Library",
  "Public Library": "School or Library",
  "School District": "School or Library",
  Library: "School or Library",
};

/**
 * Get available election types for a given authority type.
 */
export function getElectionTypesForAuthority(
  authorityType: string,
): ElectionTypeOption[] {
  const category = AUTHORITY_TYPE_TO_CATEGORY[authorityType] ?? authorityType;
  return ELECTION_TYPES_BY_CATEGORY[category] ?? [];
}

/**
 * Derive the election name from authority, type, date, certification date,
 * and amendment status.
 *
 * Format: "Authority - Type Election - MM/DD/YYYY - Certified MM/DD/YYYY"
 * or:     "Authority - Type Election - MM/DD/YYYY - Certified MM/DD/YYYY - Amended MM/DD/YYYY"
 */
export function deriveElectionName(
  date: string,
  electionType: string,
  authorityName?: string,
  certificationDate?: string,
  isAmended?: boolean,
  amendmentDate?: string,
): string {
  let name = authorityName ? `${authorityName} - ` : "";
  name += `${electionType} Election - ${date}`;
  if (certificationDate) {
    name += ` - Certified ${certificationDate}`;
  }
  if (isAmended && amendmentDate) {
    name += ` - Amended ${amendmentDate}`;
  }
  return name;
}

/**
 * File types in the required upload order for the wizard.
 */
export const UPLOAD_STEPS = [
  {
    fileType: "poll-sites",
    label: "Poll Sites",
    description:
      "Upload the CSV file with polling site locations and details for this election.",
    accept: ".csv",
    isCSV: true,
    required: false,
  },
  {
    fileType: "election-results",
    label: "Election Results",
    description:
      "Upload the CSV file containing vote tallies and candidate outcomes.",
    accept: ".csv",
    isCSV: true,
    required: false,
  },
  {
    fileType: "voter-information",
    label: "Voter Information",
    description:
      "Upload the CSV file with voter participation and registration records.",
    accept: ".csv",
    isCSV: true,
    required: false,
  },
  {
    fileType: "district-maps",
    label: "District Maps",
    description:
      "Upload a .zip file containing a shapefile bundle (.shp, .shx, .dbf, .prj) — it will be automatically converted to GeoJSON — or upload a .geojson file directly.",
    accept: ".zip,.geojson,.json",
    isCSV: false,
    required: false,
  },
] as const;

export type UploadStepFileType = (typeof UPLOAD_STEPS)[number]["fileType"];
