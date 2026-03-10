/**
 * User-facing error and success messages for file upload validation.
 * Used primarily in server actions (actions.ts) for CSV validation,
 * shapefile conversion, and GCS upload results.
 */

export const validationMessages = {
  serverNotConfigured:
    "The server is not properly configured for file storage. Please contact your administrator.",

  noFileProvided:
    "No file was provided. Please select a file and try again.",

  fileTooLarge:
    "This file is too large. The maximum allowed size is 5 MB. Please reduce the file size and try again.",

  notCsv: "This file is not a CSV. Please upload a .csv file.",

  emptyCsv:
    "This CSV file appears to be empty. It must contain a header row and at least one row of data.",

  columnMismatch: {
    base: "The column headers in your file do not match what is expected.",
    missingColumns: (columns: string) => `\n\nMissing columns: ${columns}`,
    unexpectedColumns: (columns: string) =>
      `\n\nUnexpected columns: ${columns}`,
    footer:
      "\n\nPlease check that your file has the correct columns in the right order.",
  },

  rowValidation: {
    wrongColumnCount: (
      rowNumber: number,
      expected: number,
      actual: number,
    ) =>
      `Row ${rowNumber} has the wrong number of columns. We expected ${expected} columns but found ${actual}. Please check that row for missing or extra commas.`,
    requiredFieldBlank: (rowNumber: number, columnName: string) =>
      `Row ${rowNumber}, column "${columnName}": This field is required but was left blank. Please fill in a value.`,
    typeMismatch: (
      rowNumber: number,
      columnName: string,
      expectedType: string,
      actualValue: string,
    ) =>
      `Row ${rowNumber}, column "${columnName}": Expected ${expectedType} but found ${actualValue}. Please correct this value.`,
  },

  districtMaps: {
    invalidFileType:
      "This file type is not accepted for District Maps. Please upload a .zip file (containing shapefiles) or a .geojson file.",
    shapefileConverted: (
      fileName: string,
      featureCount: string,
    ) =>
      `${fileName} was converted to GeoJSON and uploaded successfully${featureCount}.`,
    geojsonUploaded: (fileName: string, featureCount: string) =>
      `${fileName} has been uploaded successfully${featureCount}.`,
  },

  unrecognizedFileType: (fileType: string) =>
    `We don't recognize this file type ("${fileType}"). Please try a different upload option.`,

  uploadSuccess: (
    friendlyFileType: string,
    rowCount: number,
  ) =>
    `${friendlyFileType} successfully uploaded \u2014 ${rowCount} row${rowCount !== 1 ? "s" : ""}.`,

  gcsConnectionError:
    "There was a temporary problem connecting to the file storage service. Please wait a moment and try again.",

  genericUploadError:
    "There was a problem uploading your file. Please try again. If the problem continues, contact your administrator.",

  electionEvents: {
    duplicateEvent: (name: string) =>
      `An election event named "${name}" already exists for your authority. Please choose a different date or election type.`,
    created: (name: string) =>
      `Election event "${name}" has been created.`,
    createFailed: (detail: string) =>
      `Failed to create the election event: ${detail}`,
    notFound:
      "The election event could not be found. It may have already been deleted.",
    deleted: (name: string) =>
      `Election event "${name}" has been deleted.`,
    deleteFailed: (detail: string) =>
      `Failed to delete the election event: ${detail}`,
  },

  certifications: {
    duplicate: (year: number) =>
      `A "No Elections" certification for ${year} already exists for your authority.`,
    success: (year: number) =>
      `Your authority has been certified as having no elections in ${year}.`,
    error:
      "Something went wrong while saving the certification. Please try again.",
  },

  attestations: {
    noChangeLabel: "Attested \u2014 No changes since previous election",
    stateGeoLabel: "Attested \u2014 State GEO maps are accurate",
    logMessage: (fileTypeLabel: string) =>
      `${fileTypeLabel} requirement satisfied via attestation.`,
    successMessage: (friendlyType: string) =>
      `${friendlyType} requirement has been satisfied via attestation.`,
    error:
      "Something went wrong while recording the attestation. Please try again.",
  },

  friendlyTypeNames: {
    string: "Text",
    number: "Number",
    boolean: "Yes/No (true or false)",
    date: "Date (MM/DD/YYYY)",
  } as Record<string, string>,
} as const;
