"use client";

/**
 * Submission Log component. Renders a scrollable list of file upload attempts
 * (successes and failures) with timestamps, file names, status messages, and
 * uploader information. Used as an audit trail.
 */

import { CheckCircle2, XCircle, ScrollText, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface LogEntry {
  id?: string;
  timestamp: string;
  fileName: string;
  fileType: string;
  success: boolean;
  message: string;
  uploadedBy?: string;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  elections: "Elections Data",
  "election-results": "Election Results",
  "voter-information": "Voter Information",
  "poll-sites": "Poll Sites",
  "district-maps": "District Maps",
};

interface SubmissionLogProps {
  entries: LogEntry[];
}

export function SubmissionLog({ entries }: SubmissionLogProps) {
  return (
    <Card className="mt-8">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Submission History</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No submissions yet. Upload a file to see activity here.
          </p>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-3">
              {entries.map((entry, i) => (
                <div
                  key={entry.id ?? i}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-md border text-sm",
                    entry.success
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                      : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                  )}
                >
                  {entry.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">
                        {FILE_TYPE_LABELS[entry.fileType] ?? entry.fileType} &mdash; {entry.fileName}
                      </p>
                      <time className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(entry.timestamp).toLocaleString()}
                      </time>
                    </div>
                    <p
                      className={cn(
                        "mt-0.5",
                        entry.success
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-700 dark:text-red-400"
                      )}
                    >
                      {entry.message}
                    </p>
                    {entry.uploadedBy && (
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Uploaded by {entry.uploadedBy}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
