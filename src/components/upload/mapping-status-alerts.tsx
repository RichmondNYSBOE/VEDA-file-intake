import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";
import { uploadContent } from "@/content/upload";
import type { MatchResult } from "@/lib/header-matching";

interface MappingState {
  status: "idle" | "analyzing" | "exact" | "auto-resolved" | "needs-review" | "confirmed" | "error";
  result: MatchResult | null;
  columnOrder: number[] | null;
}

interface MappingStatusAlertsProps {
  mapping: MappingState;
  onOpenModal: () => void;
}

export function MappingStatusAlerts({
  mapping,
  onOpenModal,
}: MappingStatusAlertsProps) {
  if (mapping.status === "analyzing") {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>
          {uploadContent.headerMatching.analyzing}
        </AlertDescription>
      </Alert>
    );
  }
  if (mapping.status === "exact") {
    return (
      <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertDescription className="text-emerald-700 dark:text-emerald-400">
          {uploadContent.headerMatching.exactMatch}
        </AlertDescription>
      </Alert>
    );
  }
  if (mapping.status === "auto-resolved") {
    return (
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="flex items-center justify-between text-blue-700 dark:text-blue-400">
          <span>{uploadContent.headerMatching.autoResolved}</span>
          <Button type="button" variant="link" size="sm" className="text-blue-700 dark:text-blue-400 p-0 h-auto" onClick={(e) => { e.stopPropagation(); onOpenModal(); }}>
            {uploadContent.headerMatching.reviewMapping}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (mapping.status === "confirmed") {
    return (
      <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertDescription className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
          <span>{uploadContent.headerMatching.confirmed}</span>
          <Button type="button" variant="link" size="sm" className="text-emerald-700 dark:text-emerald-400 p-0 h-auto" onClick={(e) => { e.stopPropagation(); onOpenModal(); }}>
            {uploadContent.headerMatching.editMapping}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (mapping.status === "needs-review") {
    return (
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="flex items-center justify-between text-amber-700 dark:text-amber-400">
          <span>{uploadContent.headerMatching.needsReview}</span>
          <Button type="button" variant="link" size="sm" className="text-amber-700 dark:text-amber-400 p-0 h-auto" onClick={(e) => { e.stopPropagation(); onOpenModal(); }}>
            {uploadContent.headerMatching.reviewMapping}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (mapping.status === "error") {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{uploadContent.headerMatching.error}</span>
          <Button type="button" variant="link" size="sm" className="text-destructive p-0 h-auto" onClick={(e) => { e.stopPropagation(); onOpenModal(); }}>
            {uploadContent.headerMatching.mapColumns}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
