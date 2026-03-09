"use client";

/**
 * Confirmation dialog for deleting an election event. Warns the user if files
 * have been uploaded and that deletion is irreversible. Calls the
 * deleteElectionEvent server action.
 */

import { useState } from "react";
import { deleteElectionEvent, type ElectionEvent } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface DeleteElectionDialogProps {
  event: ElectionEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteElectionDialog({
  event,
  open,
  onOpenChange,
  onDeleted,
}: DeleteElectionDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!event) return;

    setIsDeleting(true);
    try {
      const result = await deleteElectionEvent(event.id);
      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        onDeleted();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Something went wrong while deleting the event. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!event) return null;

  const hasUploadedFiles = Object.values(event.files).some((f) => f.uploaded);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <AlertDialogTitle>Delete Election Event</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{" "}
                <strong className="text-foreground">{event.electionName}</strong>?
              </p>
              {hasUploadedFiles && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                  This event has uploaded files. Deleting the event will not remove
                  the uploaded files from storage, but they will no longer be
                  associated with this event.
                </div>
              )}
              <p>This action cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Event"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
