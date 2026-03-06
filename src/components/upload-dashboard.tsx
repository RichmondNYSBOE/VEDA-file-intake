"use client";

import { useState, useCallback, useEffect } from "react";
import { getSubmissionLogs, getAllFileVersions, type FileVersionEntry } from "@/app/actions";
import { useElectionAuthority } from "@/components/election-authority-context";
import { FileUploadCard } from "@/components/file-upload-card";
import { VersionHistoryDialog } from "@/components/version-history-dialog";
import { UploadProgressBar } from "@/components/upload-progress-bar";
import { SubmissionLog, type LogEntry } from "@/components/submission-log";
import { InfoSidebar } from "@/components/info-sidebar";
import { Table2, Vote, Users, MapPin } from "lucide-react";

const FILE_TYPES = [
  {
    title: "Elections Data",
    description: "Upload CSV files with details about different elections held.",
    fileType: "elections",
    icon: <Vote className="h-6 w-6 text-primary" />,
  },
  {
    title: "Election Results",
    description: "Upload CSV files containing results from various elections.",
    fileType: "election-results",
    icon: <Table2 className="h-6 w-6 text-primary" />,
  },
  {
    title: "Voter History",
    description: "Upload CSV files of voter participation and history records.",
    fileType: "voter-history",
    icon: <Users className="h-6 w-6 text-primary" />,
  },
  {
    title: "Poll Sites",
    description: "Upload CSV files of poll site locations and details.",
    fileType: "poll-sites",
    icon: <MapPin className="h-6 w-6 text-primary" />,
  },
];

export function UploadDashboard() {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [activeVersions, setActiveVersions] = useState<Record<string, FileVersionEntry>>({});
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; fileType: string; label: string }>({
    open: false,
    fileType: "",
    label: "",
  });
  const { selected: authority } = useElectionAuthority();

  // Derive which file types have been successfully uploaded from the log
  const uploadedFiles = new Set(
    logEntries.filter((e) => e.success).map((e) => e.fileType)
  );

  // Load persisted logs from Firestore on mount
  useEffect(() => {
    getSubmissionLogs().then((entries) => {
      setLogEntries(entries);
    });
  }, []);

  // Load active file versions when the authority changes
  const refreshVersions = useCallback(() => {
    if (!authority.name) return;
    getAllFileVersions(authority.name).then((versions) => {
      const byType: Record<string, FileVersionEntry> = {};
      for (const v of versions) {
        byType[v.fileType] = v;
      }
      setActiveVersions(byType);
    });
  }, [authority.name]);

  useEffect(() => {
    refreshVersions();
  }, [refreshVersions]);

  const handleUploadComplete = useCallback(
    (result: {
      success: boolean;
      fileName: string;
      fileType: string;
      message: string;
    }) => {
      // Optimistically prepend the new entry (it's already persisted server-side)
      setLogEntries((prev) => [
        {
          timestamp: new Date().toISOString(),
          fileName: result.fileName,
          fileType: result.fileType,
          success: result.success,
          message: result.message,
        },
        ...prev,
      ]);

      // Refresh version data after successful upload
      if (result.success) {
        refreshVersions();
      }
    },
    [refreshVersions],
  );

  const electionsUploaded = uploadedFiles.has("elections");

  return (
    <>
      <UploadProgressBar completed={uploadedFiles.size} total={4} />

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left — Upload Cards */}
        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground">
              Upload Data Files
            </h2>
            <p className="text-muted-foreground mt-1">
              Select a file type below and upload your CSV data for validation
              and storage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FILE_TYPES.map((ft) => (
              <FileUploadCard
                key={ft.fileType}
                title={ft.title}
                description={ft.description}
                fileType={ft.fileType}
                icon={ft.icon}
                disabled={ft.fileType !== "elections" && !electionsUploaded}
                currentVersion={activeVersions[ft.fileType] ?? null}
                electionAuthorityName={authority.name}
                electionAuthorityType={authority.type}
                onUploadComplete={handleUploadComplete}
                onViewHistory={() =>
                  setHistoryDialog({ open: true, fileType: ft.fileType, label: ft.title })
                }
              />
            ))}
          </div>

          {/* Submission History */}
          <SubmissionLog entries={logEntries} />
        </div>

        {/* Right — Info Sidebar */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <InfoSidebar />
        </div>
      </div>

      <VersionHistoryDialog
        open={historyDialog.open}
        onOpenChange={(open) => setHistoryDialog((prev) => ({ ...prev, open }))}
        fileType={historyDialog.fileType}
        fileTypeLabel={historyDialog.label}
        electionAuthorityName={authority.name}
      />
    </>
  );
}
