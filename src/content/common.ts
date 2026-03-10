/**
 * Shared user-facing strings used across multiple components.
 * Common button labels, status terms, and formatting patterns.
 */

export const commonContent = {
  buttons: {
    cancel: "Cancel",
    back: "Back",
    confirm: "Confirm",
    delete: "Delete",
    upload: "Upload",
    close: "Close",
    backToDashboard: "Back to Dashboard",
    skipForNow: "Skip for Now",
    removeFile: "Remove File",
    clear: "Clear",
  },

  status: {
    complete: "Complete",
    inProgress: "In Progress",
    notStarted: "Not Started",
    uploaded: "Uploaded",
    pending: "Pending",
    attested: "Attested",
    compliant: "Compliant",
    incomplete: "Incomplete",
  },

  loading: {
    submitting: "Submitting...",
    creating: "Creating...",
    uploading: "Uploading...",
    deleting: "Deleting...",
  },

  appName: "VoteVault",

  labels: {
    date: "Date:",
    type: "Type:",
    or: "or",
  },
} as const;
