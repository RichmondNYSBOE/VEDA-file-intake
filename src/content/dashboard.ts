/**
 * User-facing strings for the main dashboard view.
 * Covers page headings, empty states, button labels, status labels,
 * and file status legend.
 */

export const dashboardContent = {
  title: "Dashboard",
  description: {
    allAuthorities:
      "Track compliance status across all election authorities.",
    singleAuthority: (authorityName: string) =>
      `Manage election events and track your compliance status for ${authorityName}.`,
  },

  buttons: {
    viewHistory: "History",
    viewHistoryPrefix: "View",
    certifyNoElections: "No Elections",
    certifyNoElectionsPrefix: "Certify",
    newElectionEvent: "New Election Event",
    createFirstElection: "Create Your First Election Event",
    uploadFiles: "Upload Files",
    viewFiles: "View Files",
    deleteEvent: "Delete Event",
  },

  loading: "Loading your data...",

  emptyState: {
    singleAuthority: {
      title: "No Election Events Yet",
      description:
        "To begin uploading your election data files, you first need to create an election event. Click the button below to get started.",
    },
    allAuthorities: {
      title: "No Election Events Found",
      description:
        "None of your election authorities have created election events yet. Select a specific authority from the dropdown to create one.",
    },
  },

  sections: {
    electionEvents: "Election Events",
    noElectionsCertifications: "No-Elections Certifications",
  },

  fileStatusLegend: "File Status Legend",

  electionCard: {
    filesUploaded: (uploaded: number, total: number) =>
      `${uploaded} of ${total} files uploaded`,
    stillNeeded: "Still needed:",
    completeCount: (complete: number, total: number) =>
      `${complete}/${total} complete`,
  },

  certificationCard: {
    noElectionsCertified: (year: number) =>
      `No Elections Certified \u2014 ${year}`,
    certifiedBy: (name: string, date: string) =>
      `Certified by ${name} on ${date}`,
  },

  deleteError:
    "Something went wrong while deleting the event. Please try again.",

  infoSidebar: {
    userProfile: {
      title: "User Profile",
      nameLabel: "Name",
      nameValue: "Ryan Richmond",
      authorityTypeLabel: "Election Authority Type",
      authorityNameLabel: "Election Authority Name",
    },
    faq: {
      title: "FAQ",
      items: [
        "How do I upload a file?",
        "What file formats are accepted?",
        "What is the maximum file size?",
        "How do I correct a submission?",
      ],
    },
    dataDictionary: {
      title: "Data Dictionary",
      description:
        "Reference documentation for column definitions, data types, and validation rules for each file type.",
    },
    miscellaneousFiles: {
      title: "Miscellaneous Files",
      description:
        "Supplemental documents, templates, and reference materials.",
    },
    contactUs: {
      title: "Contact Us",
      phone: "(518) 474-6220",
      email: "info@elections.ny.gov",
      organization: "New York State Board of Elections",
    },
  },
} as const;
