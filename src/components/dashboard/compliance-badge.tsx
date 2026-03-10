import { type ComplianceStatus } from "@/domain/election/compliance";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { commonContent } from "@/content/common";

interface ComplianceBadgeProps {
  status: ComplianceStatus;
}

export function ComplianceBadge({ status }: ComplianceBadgeProps) {
  switch (status) {
    case "complete":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {commonContent.status.complete}
        </Badge>
      );
    case "in-progress":
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
          <Clock className="h-3 w-3" />
          {commonContent.status.inProgress}
        </Badge>
      );
    case "not-started":
      return (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <AlertCircle className="h-3 w-3" />
          {commonContent.status.notStarted}
        </Badge>
      );
  }
}
