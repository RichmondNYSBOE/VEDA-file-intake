"use client";

/**
 * Data Preview component. Renders a tabular preview of parsed file data (CSV,
 * Excel, JSON, or pasted) showing column headers with types, row numbers, and
 * expandable row display (5 -> 20 rows). Applies column reordering when a
 * mapping has been confirmed.
 */

import { useState } from "react";
import type { ParsedData } from "@/lib/file-parser";
import type { FieldSchema } from "@/lib/file-schemas";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataPreviewProps {
  data: ParsedData;
  schema: FieldSchema[] | null;
  /** Column reorder map — `columnOrder[schemaIdx] = uploadedIdx`. Null if no reordering needed. */
  columnOrder: number[] | null;
}

const INITIAL_ROWS = 5;
const EXPANDED_ROWS = 20;

export function DataPreview({ data, schema, columnOrder }: DataPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  if (data.rows.length === 0) return null;

  // If we have a column reorder, apply it to display data in schema order
  const displayHeaders = columnOrder && schema
    ? schema.map((s) => s.name)
    : data.headers;

  const displayRows = columnOrder
    ? data.rows.map((row) => columnOrder.map((idx) => row[idx] ?? ""))
    : data.rows;

  const rowLimit = expanded ? EXPANDED_ROWS : INITIAL_ROWS;
  const visibleRows = displayRows.slice(0, rowLimit);
  const totalRows = data.rows.length;
  const hasMore = totalRows > rowLimit;

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium">
            Data Preview
          </span>
          <Badge variant="secondary" className="text-xs">
            {totalRows} row{totalRows !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="outline" className="text-xs uppercase">
            {data.sourceFormat}
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="gap-1.5 text-xs"
        >
          {showPreview ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              Hide
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              Show
            </>
          )}
        </Button>
      </div>

      {showPreview && (
        <>
          <div className="overflow-auto max-h-[400px]">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center text-xs text-muted-foreground sticky left-0 bg-muted/50 z-10">
                      #
                    </TableHead>
                    {displayHeaders.map((header, i) => (
                      <TableHead
                        key={i}
                        className={cn(
                          "text-xs whitespace-nowrap",
                          schema?.[i]?.required !== false && "font-semibold",
                        )}
                      >
                        {header}
                        {schema?.[i]?.type && (
                          <span className="ml-1 text-muted-foreground font-normal">
                            ({schema[i].type})
                          </span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      <TableCell className="text-center text-xs text-muted-foreground sticky left-0 bg-background z-10">
                        {rowIdx + 1}
                      </TableCell>
                      {row.map((cell, colIdx) => (
                        <TableCell
                          key={colIdx}
                          className="text-xs whitespace-nowrap max-w-[200px] truncate"
                          title={cell}
                        >
                          {cell || <span className="text-muted-foreground/50 italic">empty</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Show more / less */}
          <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
            <span>
              Showing {Math.min(rowLimit, totalRows)} of {totalRows} rows
            </span>
            {(hasMore || expanded) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Show More
                  </>
                )}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
