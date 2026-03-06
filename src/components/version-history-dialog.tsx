"use client";

import { useEffect, useState } from "react";
import { getFileVersions, type FileVersionEntry } from "@/app/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, FileText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileType: string;
  fileTypeLabel: string;
  electionAuthorityName: string;
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  fileType,
  fileTypeLabel,
  electionAuthorityName,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<FileVersionEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && electionAuthorityName) {
      setLoading(true);
      getFileVersions(fileType, electionAuthorityName)
        .then(setVersions)
        .finally(() => setLoading(false));
    }
  }, [open, fileType, electionAuthorityName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Version History — {fileTypeLabel}</DialogTitle>
          <DialogDescription>
            All versions uploaded by {electionAuthorityName}. The latest version is active.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No versions uploaded yet.
          </p>
        ) : (
          <ScrollArea className="max-h-[400px] pr-3">
            <div className="space-y-1">
              {versions.map((v, idx) => (
                <div key={v.id}>
                  <div
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-md",
                      v.isActive && "bg-emerald-50 dark:bg-emerald-950/20",
                    )}
                  >
                    <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Version {v.version}
                        </span>
                        {v.isActive && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-600">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {v.fileName}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(v.uploadedAt).toLocaleString()}
                      </div>
                      {v.amendmentNotes && (
                        <p className="text-xs text-foreground/80 mt-1.5 bg-muted/50 rounded px-2 py-1">
                          {v.amendmentNotes}
                        </p>
                      )}
                    </div>
                  </div>
                  {idx < versions.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
