"use client";

/**
 * Dialog form for certifying that an election authority held no elections in a
 * given year. Offers the current year and two prior years. Records the
 * certification via the certifyNoElections server action.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { certifyNoElections } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

interface NoElectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  electionAuthorityName: string;
  electionAuthorityType: string;
  onCertified: () => void;
}

export function NoElectionsDialog({
  open,
  onOpenChange,
  electionAuthorityName,
  electionAuthorityType,
  onCertified,
}: NoElectionsDialogProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  // Offer current year and past 2 years
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const handleSubmit = async () => {
    if (!year || isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    const result = await certifyNoElections({
      year: Number(year),
      electionAuthorityName,
      electionAuthorityType,
    });

    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: "Certification Saved",
        description: result.message,
      });
      setYear(String(currentYear));
      setError("");
      onOpenChange(false);
      onCertified();
    } else {
      setError(result.message);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setYear(String(currentYear));
      setError("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Certify No Elections
          </DialogTitle>
          <DialogDescription>
            If your authority did not hold any elections during a particular
            year, you can certify that here. This will ensure your authority is
            not marked as out of compliance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cert-year">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger id="cert-year">
                <SelectValue placeholder="Select a year..." />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the calendar year for which your authority had no elections.
            </p>
          </div>

          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              By submitting this certification, you are confirming that{" "}
              <strong>{electionAuthorityName}</strong> did not conduct any
              elections during <strong>{year}</strong>. This action is recorded
              and cannot be undone.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Certify No Elections"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
