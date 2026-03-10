import { type AttestationType } from "@/app/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, ShieldCheck } from "lucide-react";
import { uploadContent } from "@/content/upload";
import { commonContent } from "@/content/common";

interface AttestationOptionsProps {
  fileType: string;
  eligibility: Record<string, boolean>;
  isAttesting: boolean;
  onAttest: (fileType: string, type: AttestationType) => void;
}

export function AttestationOptions({
  fileType,
  eligibility,
  isAttesting,
  onAttest,
}: AttestationOptionsProps) {
  if (fileType === "poll-sites") {
    const canAttestNoChange = eligibility["poll-sites:no-change"];
    if (!canAttestNoChange) return null;

    return (
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold mb-1">{uploadContent.attestation.pollSites.title}</h4>
              <p className="text-xs text-muted-foreground mb-3">
                {uploadContent.attestation.pollSites.description}
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isAttesting}
                    className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  >
                    {isAttesting ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />{commonContent.loading.submitting}</>
                    ) : (
                      <><ShieldCheck className="h-3.5 w-3.5" />{uploadContent.attestation.pollSites.buttonLabel}</>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{uploadContent.attestation.pollSites.confirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {uploadContent.attestation.pollSites.confirmDescription}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{commonContent.buttons.cancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onAttest("poll-sites", "no-change")}>
                      {uploadContent.attestation.pollSites.confirmAction}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (fileType === "district-maps") {
    const canAttestNoChange = eligibility["district-maps:no-change"];
    const canAttestGeo = eligibility["district-maps:state-geo-accurate"];
    if (!canAttestNoChange && !canAttestGeo) return null;

    return (
      <div className="space-y-3">
        {canAttestNoChange && (
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold mb-1">{uploadContent.attestation.districtMaps.noChange.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {uploadContent.attestation.districtMaps.noChange.description}
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isAttesting}
                        className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30"
                      >
                        {isAttesting ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" />{commonContent.loading.submitting}</>
                        ) : (
                          <><ShieldCheck className="h-3.5 w-3.5" />{uploadContent.attestation.districtMaps.noChange.buttonLabel}</>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{uploadContent.attestation.districtMaps.noChange.confirmTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {uploadContent.attestation.districtMaps.noChange.confirmDescription}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{commonContent.buttons.cancel}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onAttest("district-maps", "no-change")}>
                          {uploadContent.attestation.districtMaps.noChange.confirmAction}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {canAttestGeo && (
          <Card className="border-violet-200 bg-violet-50/50 dark:bg-violet-950/10 dark:border-violet-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ShieldCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold mb-1">{uploadContent.attestation.districtMaps.stateGeo.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {uploadContent.attestation.districtMaps.stateGeo.description}
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isAttesting}
                        className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-900/30"
                      >
                        {isAttesting ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" />{commonContent.loading.submitting}</>
                        ) : (
                          <><ShieldCheck className="h-3.5 w-3.5" />{uploadContent.attestation.districtMaps.stateGeo.buttonLabel}</>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{uploadContent.attestation.districtMaps.stateGeo.confirmTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {uploadContent.attestation.districtMaps.stateGeo.confirmDescription}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{commonContent.buttons.cancel}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onAttest("district-maps", "state-geo-accurate")}>
                          {uploadContent.attestation.districtMaps.stateGeo.confirmAction}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return null;
}
