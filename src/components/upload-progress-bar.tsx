"use client";

import { CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface UploadProgressBarProps {
  completed: number;
  total: number;
}

export function UploadProgressBar({ completed, total }: UploadProgressBarProps) {
  const isComplete = completed === total;
  const percentage = (completed / total) * 100;

  if (isComplete) {
    return (
      <div className="mb-8 flex flex-col items-center justify-center py-6 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
        <CheckCircle2 className="h-14 w-14 text-green-500 mb-2" />
        <p className="text-lg font-semibold text-green-700 dark:text-green-400">
          All Files Uploaded Successfully!
        </p>
        <p className="text-sm text-green-600 dark:text-green-500">
          {total}/{total} files have been validated and submitted.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-foreground">
          Upload Progress
        </h3>
        <span className="text-sm text-muted-foreground font-medium">
          {completed}/{total}
        </span>
      </div>
      <Progress
        value={percentage}
        className="h-3 bg-muted [&>div]:bg-green-500"
      />
    </div>
  );
}
