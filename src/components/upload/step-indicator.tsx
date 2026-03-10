import { UPLOAD_STEPS } from "@/lib/election-types";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { commonContent } from "@/content/common";

interface StepIndicatorProps {
  steps: typeof UPLOAD_STEPS;
  currentStep: number;
  fileStatuses: Record<string, boolean>;
  fileNames: Record<string, string | undefined>;
  onStepClick: (index: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  fileStatuses,
  fileNames,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <nav aria-label="Upload progress" className="w-full">
      <ol className="space-y-1">
        {steps.map((step, index) => {
          const isUploaded = fileStatuses[step.fileType];
          const isCurrent = index === currentStep;
          const isAttested = isUploaded && fileNames[step.fileType]?.startsWith("Attested");

          return (
            <li key={step.fileType}>
              <button
                type="button"
                onClick={() => onStepClick(index)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors text-sm",
                  isCurrent && "bg-primary/10 border border-primary/30",
                  !isCurrent && "hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium",
                    isUploaded && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                    !isUploaded && isCurrent && "bg-primary text-primary-foreground",
                    !isUploaded && !isCurrent && "bg-muted text-muted-foreground",
                  )}
                >
                  {isUploaded ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </span>

                <span
                  className={cn(
                    "flex-1 truncate",
                    isCurrent && "font-medium text-foreground",
                    !isCurrent && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>

                {isUploaded && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      isAttested
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                    )}
                  >
                    {isAttested ? commonContent.status.attested : commonContent.status.uploaded}
                  </Badge>
                )}
                {!isUploaded && !isCurrent && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {commonContent.status.pending}
                  </Badge>
                )}
                {!isUploaded && isCurrent && (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
