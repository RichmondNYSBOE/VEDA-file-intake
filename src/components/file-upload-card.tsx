// TODO: This file appears to be unused (superseded by upload-wizard.tsx). Remove after confirming with team.

"use client";

/**
 * Standalone file upload card component (legacy — the upload-wizard is now the
 * primary upload interface). Provides a card-based UI for uploading a single CSV
 * file type with drag-and-drop, automatic header analysis, column mapping modal
 * integration, version display, and amendment notes.
 */

import { useState, useRef, useTransition, useEffect, useCallback, type DragEvent, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { uploadFile } from "@/app/actions";
import { fileSchemas } from "@/lib/file-schemas";
import {
  matchHeaders,
  parseFirstLine,
  reorderCsv,
  type MatchResult,
} from "@/lib/header-matching";
import { FieldMappingModal } from "@/components/field-mapping-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { FileVersionEntry } from "@/app/actions";
import {
  UploadCloud,
  File as FileIcon,
  X,
  XCircle,
  Loader2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const formSchema = z.object({
  file: z
    .any()
    .refine((files) => files?.length === 1, "File is required.")
    .refine((files) => files?.[0]?.type === "text/csv", "Only .csv files are accepted.")
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`),
  fileType: z.string(),
});

type FormSchema = z.infer<typeof formSchema>;

interface UploadResult {
  success: boolean;
  fileName: string;
  fileType: string;
  message: string;
}

interface FileUploadCardProps {
  title: string;
  description: string;
  fileType: string;
  icon: ReactNode;
  disabled?: boolean;
  currentVersion?: FileVersionEntry | null;
  electionAuthorityName?: string;
  electionAuthorityType?: string;
  onUploadComplete?: (result: UploadResult) => void;
  onViewHistory?: () => void;
}

// ---------------------------------------------------------------------------
// Mapping state
// ---------------------------------------------------------------------------

interface MappingState {
  status: "idle" | "analyzing" | "exact" | "auto-resolved" | "needs-review" | "confirmed" | "error";
  result: MatchResult | null;
  columnOrder: number[] | null;
}

const INITIAL_MAPPING_STATE: MappingState = {
  status: "idle",
  result: null,
  columnOrder: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileUploadCard({
  title,
  description,
  fileType,
  icon,
  disabled = false,
  currentVersion,
  electionAuthorityName,
  electionAuthorityType,
  onUploadComplete,
  onViewHistory,
}: FileUploadCardProps) {
  const [isPending, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);
  const [mapping, setMapping] = useState<MappingState>(INITIAL_MAPPING_STATE);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [amendmentNotes, setAmendmentNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const schema = fileSchemas[fileType];

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      file: undefined,
      fileType: fileType,
    },
  });

  const fileList = form.watch("file");
  const file = fileList?.[0] as File | undefined;

  // ---- Analyze headers whenever the file changes ----
  const analyzeFile = useCallback(
    async (selectedFile: File) => {
      if (!schema) return;

      setMapping({ status: "analyzing", result: null, columnOrder: null });

      try {
        const headers = await parseFirstLine(selectedFile);
        const result = matchHeaders(headers, schema, fileType);

        switch (result.status) {
          case "exact-match":
            setMapping({ status: "exact", result, columnOrder: null });
            break;
          case "auto-resolved":
            setMapping({
              status: "auto-resolved",
              result,
              columnOrder: result.columnOrder,
            });
            break;
          case "needs-review":
            setMapping({ status: "needs-review", result, columnOrder: null });
            setShowMappingModal(true);
            break;
          case "error":
            setMapping({ status: "error", result, columnOrder: null });
            break;
        }
      } catch {
        setMapping(INITIAL_MAPPING_STATE);
      }
    },
    [schema, fileType],
  );

  useEffect(() => {
    if (file && file.type === "text/csv") {
      analyzeFile(file);
    } else {
      setMapping(INITIAL_MAPPING_STATE);
    }
  }, [file, analyzeFile]);

  // ---- Can the user upload? ----
  const canUpload =
    !!file &&
    !disabled &&
    !isPending &&
    (mapping.status === "exact" ||
      mapping.status === "auto-resolved" ||
      mapping.status === "confirmed");

  // ---- Submit handler: rewrite CSV if needed, then upload ----
  const onSubmit = (data: FormSchema) => {
    startTransition(async () => {
      const originalFile: File = data.file[0];
      const fileName = originalFile.name;
      let fileToUpload: File = originalFile;

      // If we have a column reorder mapping, rewrite the CSV
      if (mapping.columnOrder && schema) {
        try {
          const text = await originalFile.text();
          const rewritten = reorderCsv(text, mapping.columnOrder, schema);
          fileToUpload = new File([rewritten], originalFile.name, {
            type: "text/csv",
          });
        } catch {
          toast({
            title: "Upload Failed",
            description: "Failed to remap CSV columns. Please check your file format.",
            variant: "destructive",
          });
          return;
        }
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("fileType", data.fileType);
      if (electionAuthorityName) {
        formData.append("electionAuthorityName", electionAuthorityName);
      }
      if (electionAuthorityType) {
        formData.append("electionAuthorityType", electionAuthorityType);
      }
      if (amendmentNotes.trim()) {
        formData.append("amendmentNotes", amendmentNotes.trim());
      }

      const result = await uploadFile(formData);

      if (result.success) {
        toast({
          title: "Upload Successful",
          description: result.message,
        });
        form.reset();
        setMapping(INITIAL_MAPPING_STATE);
        setAmendmentNotes("");
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      } else {
        toast({
          title: "Upload Failed",
          description: result.message,
          variant: "destructive",
        });
      }

      onUploadComplete?.({
        success: result.success,
        fileName,
        fileType,
        message: result.message,
      });
    });
  };

  // ---- Drag and drop handlers ----
  const handleDrag = (e: DragEvent<HTMLFormElement | HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      form.setValue("file", e.dataTransfer.files);
    }
  };

  const handleRemoveFile = () => {
    form.reset();
    setMapping(INITIAL_MAPPING_STATE);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  // ---- Mapping modal confirmation ----
  const handleMappingConfirm = (columnOrder: number[]) => {
    setMapping((prev) => ({
      ...prev,
      status: "confirmed",
      columnOrder,
    }));
    setShowMappingModal(false);
  };

  return (
    <>
      <Card className={cn("flex flex-col", disabled && "opacity-60")}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-md">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle>{title}</CardTitle>
                {currentVersion && (
                  <Badge variant="secondary" className="text-xs">
                    v{currentVersion.version}
                  </Badge>
                )}
              </div>
              {currentVersion && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last updated {new Date(currentVersion.uploadedAt).toLocaleDateString()}
                  {onViewHistory && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline"
                        onClick={onViewHistory}
                      >
                        View history
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} onDragEnter={disabled ? undefined : handleDrag} className="flex flex-col flex-1">
          <CardContent className="flex-1 flex flex-col">
              {disabled ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg border-border bg-muted/30">
                  <Lock className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-3 font-medium text-muted-foreground">
                    Locked
                  </p>
                  <p className="text-sm text-muted-foreground/70 text-center mt-1">
                    Upload Elections Data first to unlock
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                      dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                      form.formState.errors.file && "border-destructive",
                      file && "border-primary/50"
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                  >
                    <Input
                      {...form.register("file")}
                      ref={inputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                    />
                    {file ? (
                      <div className="text-center">
                          <FileIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="font-medium mt-2">{file.name}</p>
                          <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-2 font-medium">Click to upload or drag and drop</p>
                        <p className="text-sm text-muted-foreground">CSV only, up to 5MB</p>
                      </div>
                    )}
                  </div>

                  {form.formState.errors.file && (
                    <p className="text-sm font-medium text-destructive mt-2">
                      {form.formState.errors.file.message as string}
                    </p>
                  )}

                  {/* ---- Header mapping status banners ---- */}
                  {file && mapping.status === "analyzing" && (
                    <Alert className="mt-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertDescription>
                        Analyzing column headers...
                      </AlertDescription>
                    </Alert>
                  )}

                  {file && mapping.status === "exact" && (
                    <Alert className="mt-3 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                        All column headers match the expected format.
                      </AlertDescription>
                    </Alert>
                  )}

                  {file && mapping.status === "auto-resolved" && (
                    <Alert className="mt-3 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="flex items-center justify-between text-blue-700 dark:text-blue-400">
                        <span>Columns automatically matched and reordered.</span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="text-blue-700 dark:text-blue-400 p-0 h-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMappingModal(true);
                          }}
                        >
                          Review mapping
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {file && mapping.status === "confirmed" && (
                    <Alert className="mt-3 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                        <span>Column mapping confirmed.</span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="text-emerald-700 dark:text-emerald-400 p-0 h-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMappingModal(true);
                          }}
                        >
                          Edit mapping
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {file && mapping.status === "needs-review" && (
                    <Alert className="mt-3 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                        <span>Some column headers need your review.</span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="text-amber-700 dark:text-amber-400 p-0 h-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMappingModal(true);
                          }}
                        >
                          Review mapping
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {file && mapping.status === "error" && (
                    <Alert variant="destructive" className="mt-3">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>Column headers don&apos;t match. Please map them manually.</span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="text-destructive p-0 h-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMappingModal(true);
                          }}
                        >
                          Map columns
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Amendment notes — shown when a file is selected and a previous version exists */}
                  {file && currentVersion && (
                    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                      <label htmlFor={`notes-${fileType}`} className="text-sm font-medium text-muted-foreground">
                        Amendment Notes <span className="text-xs font-normal">(optional)</span>
                      </label>
                      <Textarea
                        id={`notes-${fileType}`}
                        placeholder="Briefly describe what changed in this version..."
                        value={amendmentNotes}
                        onChange={(e) => setAmendmentNotes(e.target.value)}
                        className="mt-1 resize-none h-16 text-sm"
                      />
                    </div>
                  )}
                </>
              )}
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            {file && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
            <Button type="submit" disabled={!canUpload} className="ml-auto">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload File"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Field mapping modal */}
      {mapping.result && schema && (
        <FieldMappingModal
          open={showMappingModal}
          onOpenChange={setShowMappingModal}
          matchResult={mapping.result}
          schema={schema}
          onConfirm={handleMappingConfirm}
        />
      )}
    </>
  );
}
