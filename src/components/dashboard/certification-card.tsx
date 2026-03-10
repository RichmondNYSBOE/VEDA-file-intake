import { type NoElectionsCertification } from "@/app/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ban, ShieldCheck } from "lucide-react";
import { dashboardContent } from "@/content/dashboard";
import { commonContent } from "@/content/common";

interface CertificationCardProps {
  cert: NoElectionsCertification;
  showAuthority?: boolean;
}

export function CertificationCard({ cert, showAuthority }: CertificationCardProps) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
          <Ban className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {dashboardContent.certificationCard.noElectionsCertified(cert.year)}
          </p>
          <p className="text-xs text-muted-foreground">
            {showAuthority && <>{cert.electionAuthorityName} &middot; </>}
            {dashboardContent.certificationCard.certifiedBy(cert.certifiedBy, new Date(cert.certifiedAt).toLocaleDateString())}
          </p>
        </div>
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 gap-1">
          <ShieldCheck className="h-3 w-3" />
          {commonContent.status.compliant}
        </Badge>
      </CardContent>
    </Card>
  );
}
