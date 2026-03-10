import { type ElectionEvent } from "@/app/actions";
import { getComplianceStatus } from "@/domain/election/compliance";
import { UPLOAD_STEPS } from "@/lib/election-types";
import { ComplianceBadge } from "@/components/dashboard/compliance-badge";
import { FileStatusDots } from "@/components/dashboard/file-status-dots";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays,
  FileUp,
  ChevronRight,
  Building2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardContent } from "@/content/dashboard";
import { commonContent } from "@/content/common";

interface ElectionEventCardProps {
  event: ElectionEvent;
  onUploadFiles: () => void;
  onDelete: () => void;
  showAuthority?: boolean;
}

export function ElectionEventCard({
  event,
  onUploadFiles,
  onDelete,
  showAuthority,
}: ElectionEventCardProps) {
  const status = getComplianceStatus(event);
  const uploadedCount = UPLOAD_STEPS.filter(
    (s) => event.files[s.fileType]?.uploaded,
  ).length;
  const totalCount = UPLOAD_STEPS.length;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
              <h3 className="font-semibold text-base truncate">
                {event.electionName}
              </h3>
            </div>
            <div className="ml-7 space-y-2">
              {showAuthority && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {event.electionAuthorityName}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{commonContent.labels.date} {event.date}</span>
                <span>{commonContent.labels.type} {event.electionType}</span>
              </div>

              {/* File status */}
              <div className="flex items-center gap-3">
                <FileStatusDots event={event} />
                <span className={cn(
                  "text-xs font-medium",
                  uploadedCount === totalCount
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400",
                )}>
                  {dashboardContent.electionCard.filesUploaded(uploadedCount, totalCount)}
                </span>
              </div>

              {/* Missing files list */}
              {status !== "complete" && (
                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {dashboardContent.electionCard.stillNeeded}{" "}
                  <span className="font-normal">
                    {UPLOAD_STEPS.filter(
                      (s) => !event.files[s.fileType]?.uploaded,
                    )
                      .map((s) => s.label)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              <ComplianceBadge status={status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {dashboardContent.buttons.deleteEvent}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              size="sm"
              variant={status === "complete" ? "outline" : "default"}
              onClick={onUploadFiles}
              className="gap-1.5"
            >
              {status === "complete" ? (
                <>{dashboardContent.buttons.viewFiles}</>
              ) : (
                <>
                  <FileUp className="h-3.5 w-3.5" />
                  {dashboardContent.buttons.uploadFiles}
                </>
              )}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
