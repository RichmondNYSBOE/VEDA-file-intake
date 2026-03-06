"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CalendarDays, Info, Copy, Check } from "lucide-react";
import {
  getElectionTypesForAuthority,
  deriveElectionName,
} from "@/lib/election-types";
import { createElectionEvent } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

interface CreateElectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  electionAuthorityName: string;
  electionAuthorityType: string;
  onCreated: () => void;
}

export function CreateElectionDialog({
  open,
  onOpenChange,
  electionAuthorityName,
  electionAuthorityType,
  onCreated,
}: CreateElectionDialogProps) {
  const [date, setDate] = useState("");
  const [electionType, setElectionType] = useState("");
  const [certificationDate, setCertificationDate] = useState("");
  const [filingType, setFilingType] = useState<"Original" | "Amended">("Original");
  const [amendmentDate, setAmendmentDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const electionTypeOptions = getElectionTypesForAuthority(electionAuthorityType);

  // Format date inputs (YYYY-MM-DD) to MM/DD/YYYY for display
  const formatDate = (isoDate: string): string => {
    if (!isoDate) return "";
    return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formattedDate = formatDate(date);
  const formattedCertDate = formatDate(certificationDate);
  const formattedAmendDate = formatDate(amendmentDate);

  const isAmended = filingType === "Amended";

  const derivedName =
    formattedDate && electionType
      ? deriveElectionName(
          formattedDate,
          electionType,
          electionAuthorityName,
          formattedCertDate || undefined,
          isAmended,
          isAmended ? formattedAmendDate || undefined : undefined,
        )
      : "";

  const canSubmit =
    !!date &&
    !!electionType &&
    !!certificationDate &&
    (!isAmended || !!amendmentDate) &&
    !isSubmitting;

  const handleCopyName = async () => {
    if (!derivedName) return;
    try {
      await navigator.clipboard.writeText(derivedName);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Election name copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = derivedName;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError("");

    const result = await createElectionEvent({
      date: formattedDate,
      electionType,
      electionName: derivedName,
      electionAuthorityName,
      electionAuthorityType,
    });

    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: "Election Event Created",
        description: result.message,
      });
      // Reset form
      setDate("");
      setElectionType("");
      setCertificationDate("");
      setFilingType("Original");
      setAmendmentDate("");
      setError("");
      onOpenChange(false);
      onCreated();
    } else {
      setError(result.message);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDate("");
      setElectionType("");
      setCertificationDate("");
      setFilingType("Original");
      setAmendmentDate("");
      setError("");
      setCopied(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Create Election Event
          </DialogTitle>
          <DialogDescription>
            Set up a new election event to begin uploading your files. The
            generated election name must be entered into all submitted documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Election Authority (read-only context) */}
          <div className="rounded-md bg-muted/50 border p-3">
            <p className="text-xs text-muted-foreground mb-1">
              Election Authority
            </p>
            <p className="font-medium text-sm">{electionAuthorityName}</p>
            <p className="text-xs text-muted-foreground">{electionAuthorityType}</p>
          </div>

          {/* Election Date */}
          <div className="space-y-2">
            <Label htmlFor="election-date">Election Date</Label>
            <Input
              id="election-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Select the date on which the election was or will be held.
            </p>
          </div>

          {/* Election Type */}
          <div className="space-y-2">
            <Label htmlFor="election-type">Election Type</Label>
            {electionTypeOptions.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No election types are available for your authority type (
                  {electionAuthorityType}). Please contact your administrator.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={electionType} onValueChange={setElectionType}>
                <SelectTrigger id="election-type">
                  <SelectValue placeholder="Choose an election type..." />
                </SelectTrigger>
                <SelectContent>
                  {electionTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Certification Date */}
          <div className="space-y-2">
            <Label htmlFor="certification-date">Certification Date</Label>
            <Input
              id="certification-date"
              type="date"
              value={certificationDate}
              onChange={(e) => setCertificationDate(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              The date on which the election results were certified.
            </p>
          </div>

          {/* Original / Amended */}
          <div className="space-y-2">
            <Label htmlFor="filing-type">Filing Type</Label>
            <Select
              value={filingType}
              onValueChange={(v) => setFilingType(v as "Original" | "Amended")}
            >
              <SelectTrigger id="filing-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Original">Original</SelectItem>
                <SelectItem value="Amended">Amended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amendment Date (only when Amended) */}
          {isAmended && (
            <div className="space-y-2">
              <Label htmlFor="amendment-date">Amendment Date</Label>
              <Input
                id="amendment-date"
                type="date"
                value={amendmentDate}
                onChange={(e) => setAmendmentDate(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                The date this amended filing is being submitted.
              </p>
            </div>
          )}

          {/* Derived Election Name Preview with Copy */}
          {derivedName && (
            <div className="rounded-md bg-muted/50 border p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">
                  Election Name (auto-generated)
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={handleCopyName}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="font-medium text-sm break-words">{derivedName}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                You must enter this name into all of your submitted documents for
                validation.
              </p>
            </div>
          )}

          {/* Error */}
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
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Election Event"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
