"use client";

import { useState, useMemo } from "react";
import type { FieldSchema } from "@/lib/file-schemas";
import type { MatchResult, MatchConfidence } from "@/lib/header-matching";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldMappingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchResult: MatchResult;
  schema: FieldSchema[];
  onConfirm: (columnOrder: number[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UNASSIGNED = "__unassigned__";

function confidenceBadge(confidence: MatchConfidence) {
  switch (confidence) {
    case "exact":
    case "normalized":
      return (
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Matched
        </Badge>
      );
    case "alias":
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Alias
        </Badge>
      );
    case "fuzzy":
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Fuzzy
        </Badge>
      );
    case "none":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          No match
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FieldMappingModal({
  open,
  onOpenChange,
  matchResult,
  schema,
  onConfirm,
}: FieldMappingModalProps) {
  // State: for each schema field, which uploaded column index is assigned?
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const m of matchResult.schemaMatches) {
      initial[m.schemaField] =
        m.matchedUploadedIndex !== null
          ? String(m.matchedUploadedIndex)
          : UNASSIGNED;
    }
    return initial;
  });

  const uploadedHeaders = matchResult.uploadedHeaders;

  // Set of currently assigned uploaded indices (to prevent duplicate assignments)
  const assignedIndices = useMemo(() => {
    const set = new Set<string>();
    for (const val of Object.values(assignments)) {
      if (val !== UNASSIGNED) set.add(val);
    }
    return set;
  }, [assignments]);

  // Validation: all schema fields must be assigned, no duplicates
  const allAssigned = schema.every(
    (f) => assignments[f.name] !== undefined && assignments[f.name] !== UNASSIGNED,
  );

  const hasDuplicates = useMemo(() => {
    const vals = Object.values(assignments).filter((v) => v !== UNASSIGNED);
    return new Set(vals).size !== vals.length;
  }, [assignments]);

  const canConfirm = allAssigned && !hasDuplicates;

  // Count how many need attention
  const needsAttentionCount = matchResult.schemaMatches.filter(
    (m) => m.confidence === "fuzzy" || m.confidence === "none",
  ).length;

  const handleAssign = (schemaField: string, value: string) => {
    setAssignments((prev) => ({ ...prev, [schemaField]: value }));
  };

  const handleConfirm = () => {
    const columnOrder = schema.map((f) => Number(assignments[f.name]));
    onConfirm(columnOrder);
  };

  // Sort: problematic fields first, then by schema order
  const sortedMatches = useMemo(() => {
    return [...matchResult.schemaMatches].sort((a, b) => {
      const aProblematic = a.confidence === "none" || a.confidence === "fuzzy";
      const bProblematic = b.confidence === "none" || b.confidence === "fuzzy";
      if (aProblematic && !bProblematic) return -1;
      if (!aProblematic && bProblematic) return 1;
      return a.schemaIndex - b.schemaIndex;
    });
  }, [matchResult.schemaMatches]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Map Column Headers</DialogTitle>
          <DialogDescription>
            {needsAttentionCount > 0
              ? `${needsAttentionCount} column${needsAttentionCount === 1 ? " needs" : "s need"} your attention. Review the mapping below and correct any mismatches.`
              : "Review the auto-detected column mapping below."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          <div className="space-y-1">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide sticky top-0 bg-background z-10">
              <span>Expected Field</span>
              <span className="w-20 text-center">Status</span>
              <span>Your Column</span>
            </div>

            {sortedMatches.map((match) => {
              const isProblematic =
                match.confidence === "none" || match.confidence === "fuzzy";
              const currentAssignment = assignments[match.schemaField];
              const schemaField = schema.find(
                (f) => f.name === match.schemaField,
              );

              return (
                <div
                  key={match.schemaField}
                  className={cn(
                    "grid grid-cols-[1fr_auto_1fr] gap-3 items-center px-2 py-2 rounded-md",
                    isProblematic && "bg-amber-50 dark:bg-amber-950/20",
                  )}
                >
                  {/* Schema field name */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {match.schemaField}
                    </p>
                    {schemaField?.required !== false && (
                      <p className="text-xs text-muted-foreground">Required</p>
                    )}
                  </div>

                  {/* Confidence badge */}
                  <div className="w-20 flex justify-center">
                    {confidenceBadge(
                      currentAssignment !== UNASSIGNED &&
                        currentAssignment !== String(match.matchedUploadedIndex)
                        ? "exact"
                        : match.confidence,
                    )}
                  </div>

                  {/* Dropdown to pick uploaded column */}
                  <Select
                    value={currentAssignment}
                    onValueChange={(val) =>
                      handleAssign(match.schemaField, val)
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        "h-9 text-sm",
                        currentAssignment === UNASSIGNED &&
                          "border-destructive text-destructive",
                      )}
                    >
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>
                        <span className="text-muted-foreground">
                          -- Not mapped --
                        </span>
                      </SelectItem>
                      {uploadedHeaders.map((header, idx) => {
                        const idxStr = String(idx);
                        const isUsedElsewhere =
                          assignedIndices.has(idxStr) &&
                          currentAssignment !== idxStr;
                        return (
                          <SelectItem
                            key={idx}
                            value={idxStr}
                            disabled={isUsedElsewhere}
                          >
                            {header}
                            {isUsedElsewhere && " (already mapped)"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          {/* Unmatched uploaded headers info */}
          {matchResult.unmatchedUploadedHeaders.length > 0 && (
            <div className="mt-4 p-3 rounded-md bg-muted/50 border">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Extra columns in your file (will be dropped):
              </p>
              <p className="text-sm text-muted-foreground">
                {matchResult.unmatchedUploadedHeaders
                  .map((u) => u.header)
                  .join(", ")}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 flex-shrink-0">
          {hasDuplicates && (
            <p className="text-sm text-destructive mr-auto">
              Each column can only be mapped once.
            </p>
          )}
          {!allAssigned && !hasDuplicates && (
            <p className="text-sm text-muted-foreground mr-auto">
              All fields must be mapped before confirming.
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Confirm Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
