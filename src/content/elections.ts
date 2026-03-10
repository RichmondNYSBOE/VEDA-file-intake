/**
 * User-facing strings for election event dialogs: create, delete,
 * and no-elections certification.
 */

export const electionsContent = {
  createDialog: {
    title: "Create Election Event",
    description:
      "Set up a new election event to begin uploading your files. The generated election name must be entered into all submitted documents.",
    electionAuthorityLabel: "Election Authority",
    electionDateLabel: "Election Date",
    electionDateHelp:
      "Select the date on which the election was or will be held.",
    electionTypeLabel: "Election Type",
    electionTypePlaceholder: "Choose an election type...",
    noElectionTypesAvailable: (authorityType: string) =>
      `No election types are available for your authority type (${authorityType}). Please contact your administrator.`,
    certificationDateLabel: "Certification Date",
    certificationDateHelp:
      "The date on which the election results were certified.",
    filingTypeLabel: "Filing Type",
    filingTypeOriginal: "Original",
    filingTypeAmended: "Amended",
    amendmentDateLabel: "Amendment Date",
    amendmentDateHelp:
      "The date this amended filing is being submitted.",
    electionNameLabel: "Election Name (auto-generated)",
    copyButton: "Copy",
    copiedButton: "Copied",
    electionNameWarning:
      "You must enter this name into all of your submitted documents for validation.",
    submitButton: "Create Election Event",
    toast: {
      copiedTitle: "Copied",
      copiedDescription: "Election name copied to clipboard.",
      createdTitle: "Election Event Created",
    },
  },

  deleteDialog: {
    title: "Delete Election Event",
    confirmPrompt: (eventName: string) =>
      `Are you sure you want to delete ${eventName}?`,
    hasUploadedFilesWarning:
      "This event has uploaded files. Deleting the event will not remove the uploaded files from storage, but they will no longer be associated with this event.",
    cannotUndo: "This action cannot be undone.",
    deleteButton: "Delete Event",
  },

  noElectionsDialog: {
    title: "Certify No Elections",
    description:
      "If your authority did not hold any elections during a particular year, you can certify that here. This will ensure your authority is not marked as out of compliance.",
    yearLabel: "Year",
    yearPlaceholder: "Select a year...",
    yearHelp:
      "Select the calendar year for which your authority had no elections.",
    certificationWarning: (authorityName: string, year: string) =>
      `By submitting this certification, you are confirming that ${authorityName} did not conduct any elections during ${year}. This action is recorded and cannot be undone.`,
    submitButton: "Certify No Elections",
    toast: {
      certifiedTitle: "Certification Saved",
    },
  },
} as const;
