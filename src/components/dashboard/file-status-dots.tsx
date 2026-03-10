import { type ElectionEvent } from "@/domain/types";
import { UPLOAD_STEPS } from "@/lib/election-types";
import { cn } from "@/lib/utils";
import { commonContent } from "@/content/common";

interface FileStatusDotsProps {
  event: ElectionEvent;
}

export function FileStatusDots({ event }: FileStatusDotsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {UPLOAD_STEPS.map((step) => {
        const isUploaded = event.files[step.fileType]?.uploaded;
        return (
          <div
            key={step.fileType}
            title={`${step.label}: ${isUploaded ? commonContent.status.uploaded : commonContent.status.pending}`}
            className={cn(
              "w-2.5 h-2.5 rounded-full",
              isUploaded
                ? "bg-emerald-500"
                : "bg-gray-300 dark:bg-gray-600",
            )}
          />
        );
      })}
    </div>
  );
}
