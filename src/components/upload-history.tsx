"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getElectionEvents,
  getSubmissionLogs,
  type ElectionEvent,
  type SubmissionLogEntry,
} from "@/app/actions";
import { useElectionAuthority } from "@/components/election-authority-context";
import { UPLOAD_STEPS } from "@/lib/election-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  FileUp,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadHistoryProps {
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileStatusSummary(event: ElectionEvent): {
  uploaded: number;
  pending: number;
} {
  let uploaded = 0;
  let pending = 0;
  for (const s of UPLOAD_STEPS) {
    const fs = event.files[s.fileType];
    if (fs?.uploaded) uploaded++;
    else pending++;
  }
  return { uploaded, pending };
}

// ---------------------------------------------------------------------------
// Event history card (expandable)
// ---------------------------------------------------------------------------

function EventHistoryCard({ event }: { event: ElectionEvent }) {
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<SubmissionLogEntry[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);

  const loadLogs = useCallback(async () => {
    if (logsLoaded) return;
    const data = await getSubmissionLogs(event.id);
    setLogs(data);
    setLogsLoaded(true);
  }, [event.id, logsLoaded]);

  const handleToggle = () => {
    if (!expanded) loadLogs();
    setExpanded((prev) => !prev);
  };

  const summary = getFileStatusSummary(event);
  const isComplete = summary.pending === 0;

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={handleToggle}
          className="w-full flex items-start gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">
                {event.electionName}
              </h3>
              {isComplete ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  Complete
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  In Progress
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Date: {event.date}</span>
              <span>Type: {event.electionType}</span>
              <span>
                Created: {new Date(event.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* File summary */}
            <div className="flex flex-wrap gap-2 mt-2">
              {UPLOAD_STEPS.map((step) => {
                const isUploaded = event.files[step.fileType]?.uploaded;
                return (
                  <Badge
                    key={step.fileType}
                    variant="outline"
                    className={cn(
                      "text-xs gap-1",
                      isUploaded &&
                        "border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/20",
                    )}
                  >
                    {isUploaded ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    )}
                    {step.label}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="flex-shrink-0 mt-1">
            {expanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded: file details and submission logs */}
        {expanded && (
          <div className="border-t px-5 pb-5">
            {/* File details */}
            <div className="py-4">
              <h4 className="text-sm font-semibold mb-3">File Details</h4>
              <div className="space-y-2">
                {UPLOAD_STEPS.map((step) => {
                  const fs = event.files[step.fileType];
                  const isUploaded = fs?.uploaded;

                  return (
                    <div
                      key={step.fileType}
                      className="flex items-center gap-3 text-sm"
                    >
                      <div className="w-5 flex-shrink-0">
                        {isUploaded ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                      <span className="font-medium w-32 flex-shrink-0">
                        {step.label}
                      </span>
                      {isUploaded ? (
                        <span className="text-muted-foreground truncate">
                          {fs?.fileName}
                          {fs?.uploadedBy && <> &mdash; {fs.uploadedBy}</>}
                          {fs?.uploadedAt && (
                            <>
                              {" "}
                              on{" "}
                              {new Date(fs.uploadedAt).toLocaleDateString()}
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 italic text-xs">
                          Not yet uploaded
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submission logs */}
            {logs.length > 0 && (
              <>
                <Separator className="my-2" />
                <div className="pt-3">
                  <h4 className="text-sm font-semibold mb-3">
                    Submission Log ({logs.length} entries)
                  </h4>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className={cn(
                            "flex items-start gap-3 p-2.5 rounded-md border text-sm",
                            log.success
                              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                              : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20",
                          )}
                        >
                          {log.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium truncate text-xs">
                                {log.fileName}
                              </p>
                              <time className="text-xs text-muted-foreground flex-shrink-0">
                                {new Date(log.timestamp).toLocaleString()}
                              </time>
                            </div>
                            <p
                              className={cn(
                                "text-xs mt-0.5",
                                log.success
                                  ? "text-green-700 dark:text-green-400"
                                  : "text-red-700 dark:text-red-400",
                              )}
                            >
                              {log.message}
                            </p>
                            {log.uploadedBy && (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {log.uploadedBy}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            {logsLoaded && logs.length === 0 && (
              <>
                <Separator className="my-2" />
                <p className="text-sm text-muted-foreground pt-3 italic">
                  No submission activity recorded for this election event.
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UploadHistory({ onBack }: UploadHistoryProps) {
  const { selected: authority } = useElectionAuthority();
  const [events, setEvents] = useState<ElectionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authority.name) return;
    setIsLoading(true);
    getElectionEvents(authority.name).then((data) => {
      setEvents(data);
      setIsLoading(false);
    });
  }, [authority.name]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileUp className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold text-foreground">
            Upload History
          </h2>
        </div>
        <p className="text-muted-foreground">
          View all historical upload activity for{" "}
          <strong>{authority.name}</strong>, organized by election event.
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading history...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && events.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No History Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              There are no election events or upload activity to display.
              Create an election event and upload files to see your history
              here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Event list */}
      {!isLoading && events.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {events.length} election event{events.length !== 1 ? "s" : ""} found.
            Click an event to view details and submission logs.
          </p>
          {events.map((event) => (
            <EventHistoryCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
