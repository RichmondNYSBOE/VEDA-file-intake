/**
 * User-facing strings for the upload wizard flow.
 * Covers step navigation, file selection, header matching,
 * data preview, attestation, and amendment acknowledgment.
 */

export const uploadContent = {
  wizard: {
    title: "Upload Files",
    progressLabel: "Upload Progress",
    filesUploadedTemplate: (uploaded: number, total: number) =>
      `${uploaded} of ${total} files uploaded`,
    allFilesComplete:
      "All files have been uploaded for this election event. You may return to the dashboard.",
    submissionIncomplete: (remaining: number) =>
      `Your submission is incomplete. ${remaining} file${remaining !== 1 ? "s" : ""} still${remaining !== 1 ? " need" : " needs"} to be uploaded.`,
    uploadHistory: "Upload History",
  },

  fileSelection: {
    tabs: {
      uploadFile: "Upload File",
      pasteData: "Paste Data",
    },
    dragDrop: {
      prompt: "Click to select a file or drag and drop",
      csvFormats: "CSV, Excel (.xlsx, .xls), or JSON — up to 5 MB",
      districtMapsFormats:
        ".zip (shapefile — auto-converted to GeoJSON) or .geojson, up to 5 MB",
    },
    paste: {
      label:
        "Paste tab-delimited data from Google Sheets, Excel, or similar",
      instruction:
        "Select your data including the header row, copy it (Ctrl+C / Cmd+C), then paste it below.",
      placeholder: "Column1\tColumn2\tColumn3\nvalue1\tvalue2\tvalue3\n...",
      analyzeButton: "Analyze Pasted Data",
      detectedData: (columns: number, rows: number) =>
        `Detected ${columns} columns and ${rows} rows from pasted data.`,
      invalidPasteTitle: "Invalid paste",
      invalidPasteDescription:
        "Could not detect any columns. Make sure you copy the header row along with the data.",
    },
    uploadFileButton: "Upload File",
    uploadDataButton: "Upload Data",
    fileReadyToUpload: "Your file is ready to upload.",
    replaceFileHint:
      "You can replace this file by uploading a new one below, or continue to the next step.",
    orUploadFile: "or upload a file",
  },

  headerMatching: {
    analyzing: "Checking your column headers...",
    exactMatch:
      "All column headers match the expected format. Your data is ready to upload.",
    autoResolved: "Your columns were automatically matched and reordered.",
    reviewMapping: "Review mapping",
    confirmed: "Column mapping confirmed. Ready to upload.",
    editMapping: "Edit mapping",
    needsReview:
      "Some column headers could not be matched automatically. Please review them.",
    error:
      "The columns in your file don't match what we expect. Please map them manually.",
    mapColumns: "Map columns",
  },

  validation: {
    csvFileType: "Please upload a .csv, .xlsx, .xls, or .json file.",
    districtMapsFileType:
      "Please upload a .zip (shapefile) or .geojson file.",
    fileTooLarge: "This file is too large. Maximum size is 5 MB.",
    selectFile: "Please select a file.",
  },

  attestation: {
    pollSites: {
      title: "Attest to Unchanged Poll Sites",
      description:
        "If your poll site locations have not changed since the previous election, you can attest to that instead of uploading a new file.",
      buttonLabel: "Attest — No Changes",
      confirmTitle: "Confirm Poll Sites Attestation",
      confirmDescription:
        "You are attesting that your poll site locations have not changed since the previous election. This attestation will be recorded and is publicly visible for compliance tracking. Are you sure you want to proceed?",
      confirmAction: "Yes, Submit Attestation",
    },
    districtMaps: {
      noChange: {
        title: "Attest to Unchanged Maps",
        description:
          "If your district maps have not changed since the previous election, you can attest to that instead of uploading a new file.",
        buttonLabel: "Attest — No Changes",
        confirmTitle: "Confirm District Maps Attestation",
        confirmDescription:
          "You are attesting that your district maps have not changed since the previous election. This attestation will be recorded and is publicly visible for compliance tracking. Are you sure you want to proceed?",
        confirmAction: "Yes, Submit Attestation",
      },
      stateGeo: {
        title: "Attest to State GEO Map Accuracy",
        description:
          "If the State GEO maps are accurate and up to date for your jurisdiction, you can attest to that instead of uploading your own maps.",
        buttonLabel: "Attest — State GEO Maps Accurate",
        confirmTitle: "Confirm State GEO Maps Attestation",
        confirmDescription:
          "You are attesting that the State GEO maps are accurate and up to date for your jurisdiction. This attestation will be recorded and is publicly visible for compliance tracking. Are you sure you want to proceed?",
        confirmAction: "Yes, Submit Attestation",
      },
    },
    attestationRecorded: "Attestation Recorded",
    attestationFailed: "Attestation Failed",
  },

  amendment: {
    inlineWarning:
      "Uploading a new file will replace the current submission and create a new version (amendment).",
    notesLabel: "Amendment Notes (optional)",
    notesPlaceholder:
      "Briefly describe the reason for this amendment...",
  },

  toast: {
    uploadSuccessTitle: "Upload Successful",
    uploadFailedTitle: "Upload Failed",
  },
} as const;
