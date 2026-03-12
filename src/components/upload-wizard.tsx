"use client";

/**
 * Multi-step upload wizard for submitting election data files. Guides users
 * through uploading 4 file types (poll-sites, election-results, voter-information,
 * district-maps) with: drag-and-drop file selection, paste-from-spreadsheet
 * support, automatic column header matching and reordering, data preview,
 * amendment acknowledgment for re-uploads, and per-step progress tracking.
 */

import { useState, useRef, useCallback, useEffect, useTransition, type DragEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  uploadFile,
  getSubmissionLogs,
  checkAttestationEligibility,
  submitAttestation,
  type ElectionEvent,
  type SubmissionLogEntry,
  type AttestationType,
} from "@/app/actions";
import { fileSchemas } from "@/lib/file-schemas";
import {
  matchHeaders,
  reorderCsv,
  type MatchResult,
} from "@/lib/header-matching";
import { parseFile, parseTabDelimited, toCsvString, type ParsedData } from "@/lib/file-parser";
import { UPLOAD_STEPS } from "@/lib/election-types";
import { FieldMappingModal } from "@/components/field-mapping-modal";
import { DataPreview } from "@/components/data-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  File as FileIcon,
  X,
  XCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Check,
  ScrollText,
  User,
  FileEdit,
  ClipboardPaste,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadContent } from "@/content/upload";
import { commonContent } from "@/content/common";
import { StepIndicator } from "@/components/upload/step-indicator";
import { MappingStatusAlerts } from "@/components/upload/mapping-status-alerts";
import { AttestationOptions } from "@/components/upload/attestation-options";
import { formatBytes, getFileFormatLabel } from "@/components/upload/helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadWizardProps {
  electionEvent: ElectionEvent;
  electionAuthorityName: string;
  electionAuthorityType: string;
  onBack: () => void;
}

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

// Accepted file extensions for CSV-type steps
const CSV_ACCEPT = ".csv,.xlsx,.xls,.json";

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export function UploadWizard({
  electionEvent: initialEvent,
  electionAuthorityName,
  electionAuthorityType,
  onBack,
}: UploadWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [event, setEvent] = useState<ElectionEvent>(initialEvent);
  const [logs, setLogs] = useState<SubmissionLogEntry[]>([]);
  const [isPending, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);
  const [mapping, setMapping] = useState<MappingState>(INITIAL_MAPPING_STATE);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [stepAmendmentNotes, setStepAmendmentNotes] = useState("");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [attestationEligibility, setAttestationEligibility] = useState<Record<string, boolean>>({});
  const [isAttesting, setIsAttesting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const step = UPLOAD_STEPS[currentStep];
  const isCSV = step.isCSV;
  const schema = isCSV ? fileSchemas[step.fileType] : null;

  // File statuses from the event
  const fileStatuses: Record<string, boolean> = {};
  for (const s of UPLOAD_STEPS) {
    fileStatuses[s.fileType] = event.files[s.fileType]?.uploaded ?? false;
  }

  const allUploaded = UPLOAD_STEPS.every((s) => fileStatuses[s.fileType]);

  // Form schema — accept CSV, XLSX, XLS, JSON for data steps
  const formSchema = z.object({
    file: z
      .any()
      .refine((files: FileList | undefined) => files?.length === 1, uploadContent.validation.selectFile)
      .refine(
        (files: FileList | undefined) => {
          if (!files?.[0]) return false;
          if (isCSV) {
            const name = files[0].name.toLowerCase();
            return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".json");
          }
          const name = files[0].name.toLowerCase();
          return name.endsWith(".zip") || name.endsWith(".geojson") || name.endsWith(".json");
        },
        isCSV
          ? uploadContent.validation.csvFileType
          : uploadContent.validation.districtMapsFileType,
      )
      .refine(
        (files: FileList | undefined) => (files?.[0]?.size ?? 0) <= 5 * 1024 * 1024,
        uploadContent.validation.fileTooLarge,
      ),
  });

  type FormSchema = z.infer<typeof formSchema>;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { file: undefined },
  });

  const fileList = form.watch("file");
  const file = fileList?.[0] as File | undefined;

  // Load submission logs
  useEffect(() => {
    getSubmissionLogs(initialEvent.id).then(setLogs);
  }, [initialEvent.id]);

  // Check attestation eligibility for poll-sites and district-maps
  useEffect(() => {
    async function checkEligibility() {
      const [pollNoChange, mapsNoChange, mapsGeo] = await Promise.all([
        checkAttestationEligibility("poll-sites", "no-change", electionAuthorityName, initialEvent.id),
        checkAttestationEligibility("district-maps", "no-change", electionAuthorityName, initialEvent.id),
        checkAttestationEligibility("district-maps", "state-geo-accurate", electionAuthorityName, initialEvent.id),
      ]);
      setAttestationEligibility({
        "poll-sites:no-change": pollNoChange.eligible,
        "district-maps:no-change": mapsNoChange.eligible,
        "district-maps:state-geo-accurate": mapsGeo.eligible,
      });
    }
    checkEligibility();
  }, [electionAuthorityName, initialEvent.id]);

  // Analyze headers from parsed data
  const analyzeData = useCallback(
    (data: ParsedData) => {
      if (!schema || !isCSV) return;
      setMapping({ status: "analyzing", result: null, columnOrder: null });

      try {
        const result = matchHeaders(data.headers, schema, step.fileType);
        switch (result.status) {
          case "exact-match":
            setMapping({ status: "exact", result, columnOrder: null });
            break;
          case "auto-resolved":
            setMapping({ status: "auto-resolved", result, columnOrder: result.columnOrder });
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
    [schema, isCSV, step.fileType],
  );

  // Parse file when selected
  useEffect(() => {
    if (!file || !isCSV) {
      setParsedData(null);
      setMapping(INITIAL_MAPPING_STATE);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await parseFile(file);
        if (cancelled) return;
        setParsedData(data);
        analyzeData(data);
      } catch {
        if (!cancelled) {
          setParsedData(null);
          setMapping(INITIAL_MAPPING_STATE);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [file, analyzeData, isCSV]);

  // Handle pasted content analysis
  const handlePasteAnalyze = useCallback(() => {
    if (!pasteContent.trim() || !schema || !isCSV) return;
    const data = parseTabDelimited(pasteContent);
    if (data.headers.length === 0) {
      toast({
        title: uploadContent.fileSelection.paste.invalidPasteTitle,
        description: uploadContent.fileSelection.paste.invalidPasteDescription,
        variant: "destructive",
      });
      return;
    }
    setParsedData(data);
    analyzeData(data);
  }, [pasteContent, schema, isCSV, analyzeData, toast]);

  // Can upload?
  const mappingReady = mapping.status === "exact" || mapping.status === "auto-resolved" || mapping.status === "confirmed";
  const canUpload = (() => {
    if (isPending) return false;
    if (inputMode === "paste") {
      return !!parsedData && parsedData.rows.length > 0 && mappingReady;
    }
    if (!file) return false;
    if (!isCSV) return true;
    return mappingReady;
  })();

  // Build upload File from current state
  const buildUploadFile = async (): Promise<{ fileToUpload: File; fileName: string } | null> => {
    if (inputMode === "paste" && parsedData) {
      let csvData: ParsedData;
      if (mapping.columnOrder && schema) {
        csvData = {
          headers: schema.map((s) => s.name),
          rows: parsedData.rows.map((row) => mapping.columnOrder!.map((idx) => row[idx] ?? "")),
          sourceFormat: "paste",
        };
      } else {
        csvData = parsedData;
      }
      const fileName = `pasted-data-${Date.now()}.csv`;
      return { fileToUpload: new File([toCsvString(csvData)], fileName, { type: "text/csv" }), fileName };
    }

    if (!file) return null;
    const fileName = file.name;

    if (!isCSV) return { fileToUpload: file, fileName };

    // Non-CSV source format or reorder needed — convert to CSV
    if (parsedData && (parsedData.sourceFormat !== "csv" || mapping.columnOrder)) {
      let csvData: ParsedData;
      if (mapping.columnOrder && schema) {
        csvData = {
          headers: schema.map((s) => s.name),
          rows: parsedData.rows.map((row) => mapping.columnOrder!.map((idx) => row[idx] ?? "")),
          sourceFormat: parsedData.sourceFormat,
        };
      } else {
        csvData = parsedData;
      }
      const csvName = fileName.replace(/\.(xlsx|xls|json)$/i, ".csv");
      return { fileToUpload: new File([toCsvString(csvData)], csvName, { type: "text/csv" }), fileName };
    }

    return { fileToUpload: file, fileName };
  };

  // Submit handler
  const handleUpload = (data?: FormSchema) => {
    startTransition(async () => {
      const built = await buildUploadFile();
      if (!built) return;

      const { fileToUpload, fileName } = built;
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("fileType", step.fileType);
      formData.append("electionAuthorityName", electionAuthorityName);
      formData.append("electionAuthorityType", electionAuthorityType);
      formData.append("electionEventId", event.id);
      if (isStepUploaded && stepAmendmentNotes) formData.append("amendmentNotes", stepAmendmentNotes);

      const result = await uploadFile(formData);

      setLogs((prev) => [{
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        fileName,
        fileType: step.fileType,
        success: result.success,
        message: result.message,
        uploadedBy: "Ryan Richmond",
        electionEventId: event.id,
      }, ...prev]);

      if (result.success) {
        toast({ title: uploadContent.toast.uploadSuccessTitle, description: result.message });
        setEvent((prev) => ({
          ...prev,
          files: { ...prev.files, [step.fileType]: { uploaded: true, fileName, uploadedAt: new Date().toISOString(), uploadedBy: "Ryan Richmond" } },
        }));
        resetFormState();
        const nextIncomplete = UPLOAD_STEPS.findIndex((s, i) => i > currentStep && !(event.files[s.fileType]?.uploaded));
        if (nextIncomplete !== -1) setCurrentStep(nextIncomplete);
      } else {
        toast({ title: uploadContent.toast.uploadFailedTitle, description: result.message, variant: "destructive" });
      }
    });
  };

  const resetFormState = () => {
    form.reset();
    setMapping(INITIAL_MAPPING_STATE);
    setParsedData(null);
    setPasteContent("");
    setInputMode("file");
    setStepAmendmentNotes("");
    if (inputRef.current) inputRef.current.value = "";
  };

  // Drag and drop
  const handleDrag = (e: DragEvent<HTMLFormElement | HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setInputMode("file");
      form.setValue("file", e.dataTransfer.files);
    }
  };

  const handleRemoveFile = () => {
    form.reset();
    setMapping(INITIAL_MAPPING_STATE);
    setParsedData(null);
    setPasteContent("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleMappingConfirm = (columnOrder: number[]) => {
    setMapping((prev) => ({ ...prev, status: "confirmed", columnOrder }));
    setShowMappingModal(false);
  };

  const handleStepChange = (index: number) => {
    resetFormState();
    setCurrentStep(index);
  };

  const handleAttestation = async (fileType: string, attestationType: AttestationType) => {
    setIsAttesting(true);
    const result = await submitAttestation({
      electionEventId: event.id,
      fileType,
      attestationType,
      electionAuthorityName,
      electionAuthorityType,
    });

    if (result.success) {
      toast({ title: uploadContent.attestation.attestationRecorded, description: result.message });
      const attestLabel =
        attestationType === "no-change"
          ? "Attested — No changes since previous election"
          : "Attested — State GEO maps are accurate";
      setEvent((prev) => ({
        ...prev,
        files: {
          ...prev.files,
          [fileType]: { uploaded: true, fileName: attestLabel, uploadedAt: new Date().toISOString(), uploadedBy: "Ryan Richmond" },
        },
      }));
      setLogs((prev) => [{
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        fileName: attestLabel,
        fileType,
        success: true,
        message: result.message,
        uploadedBy: "Ryan Richmond",
        electionEventId: event.id,
      }, ...prev]);
      const nextIncomplete = UPLOAD_STEPS.findIndex((s, i) => i > currentStep && !(event.files[s.fileType]?.uploaded));
      if (nextIncomplete !== -1) setCurrentStep(nextIncomplete);
    } else {
      toast({ title: uploadContent.attestation.attestationFailed, description: result.message, variant: "destructive" });
    }
    setIsAttesting(false);
  };

  const uploadedCount = UPLOAD_STEPS.filter((s) => event.files[s.fileType]?.uploaded).length;
  const totalCount = UPLOAD_STEPS.length;
  const isStepUploaded = fileStatuses[step.fileType];

  // Shared preview condition
  const showPreview = parsedData && parsedData.rows.length > 0 && mappingReady;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {commonContent.buttons.backToDashboard}
        </Button>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-foreground">{uploadContent.wizard.title}</h2>
        <p className="text-muted-foreground mt-1">
          {event.electionName} &mdash; {electionAuthorityName}
        </p>
      </div>

      {/* Progress summary */}
      <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{uploadContent.wizard.progressLabel}</span>
            <span className="text-sm text-muted-foreground">{uploadContent.wizard.filesUploadedTemplate(uploadedCount, totalCount)}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div
              className={cn("h-2.5 rounded-full transition-all", allUploaded ? "bg-emerald-500" : "bg-amber-500")}
              style={{ width: `${(uploadedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
        <Badge className={allUploaded ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}>
          {allUploaded ? commonContent.status.complete : commonContent.status.incomplete}
        </Badge>
      </div>

      {allUploaded && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            {uploadContent.wizard.allFilesComplete}
          </AlertDescription>
        </Alert>
      )}

      {!allUploaded && uploadedCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {uploadContent.wizard.submissionIncomplete(totalCount - uploadedCount)}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
          {/* Left sidebar — step navigation */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <Card>
              <CardContent className="p-3">
                <StepIndicator
                  steps={UPLOAD_STEPS}
                  currentStep={currentStep}
                  fileStatuses={fileStatuses}
                  fileNames={Object.fromEntries(UPLOAD_STEPS.map((s) => [s.fileType, event.files[s.fileType]?.fileName]))}
                  onStepClick={handleStepChange}
                />
              </CardContent>
            </Card>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardContent className="p-6">
                {/* Step header */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">{currentStep + 1}</span>
                    <h3 className="text-lg font-semibold">{step.label}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground ml-11">{step.description}</p>
                </div>

                {/* Already uploaded */}
                {isStepUploaded && (
                  <div className="space-y-4">
                    <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                        <strong>{event.files[step.fileType]?.fileName}</strong> was uploaded successfully
                        {event.files[step.fileType]?.uploadedBy && <> by {event.files[step.fileType]?.uploadedBy}</>}
                        {event.files[step.fileType]?.uploadedAt && <> on {new Date(event.files[step.fileType]!.uploadedAt!).toLocaleDateString()}</>}.
                      </AlertDescription>
                    </Alert>
                    <p className="text-sm text-muted-foreground">{uploadContent.fileSelection.replaceFileHint}</p>
                    {/* Inline amendment warning — shown only when a replacement file is selected */}
                    {(file || (parsedData && inputMode === "paste")) && (
                      <div className="space-y-3">
                        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                          <FileEdit className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-700 dark:text-amber-400">
                            {uploadContent.amendment.inlineWarning}
                          </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                          <Label htmlFor="step-amendment-notes">{uploadContent.amendment.notesLabel}</Label>
                          <Textarea
                            id="step-amendment-notes"
                            placeholder={uploadContent.amendment.notesPlaceholder}
                            value={stepAmendmentNotes}
                            onChange={(e) => setStepAmendmentNotes(e.target.value)}
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Attestation options for poll-sites and district-maps */}
                {!isStepUploaded && (step.fileType === "poll-sites" || step.fileType === "district-maps") && (
                  <div className="mb-4">
                    <AttestationOptions
                      fileType={step.fileType}
                      eligibility={attestationEligibility}
                      isAttesting={isAttesting}
                      onAttest={handleAttestation}
                    />
                    {(attestationEligibility[`${step.fileType}:no-change`] || attestationEligibility[`${step.fileType}:state-geo-accurate`]) && (
                      <div className="relative my-5">
                        <Separator />
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                          {uploadContent.fileSelection.orUploadFile}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ============ CSV steps: tabbed file/paste ============ */}
                {isCSV ? (
                  <Tabs value={inputMode} onValueChange={(v) => { setInputMode(v as "file" | "paste"); handleRemoveFile(); }} className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="file" className="gap-2">
                        <UploadCloud className="h-4 w-4" />
                        {uploadContent.fileSelection.tabs.uploadFile}
                      </TabsTrigger>
                      <TabsTrigger value="paste" className="gap-2">
                        <ClipboardPaste className="h-4 w-4" />
                        {uploadContent.fileSelection.tabs.pasteData}
                      </TabsTrigger>
                    </TabsList>

                    {/* --- File upload tab --- */}
                    <TabsContent value="file">
                      <form onSubmit={form.handleSubmit(handleUpload)} onDragEnter={handleDrag} className="space-y-4">
                        <div
                          className={cn(
                            "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                            dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                            form.formState.errors.file && "border-destructive",
                            file && "border-primary/50",
                          )}
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                          onClick={() => inputRef.current?.click()}
                        >
                          <Input {...form.register("file")} ref={inputRef} type="file" accept={CSV_ACCEPT} className="hidden" />
                          {file ? (
                            <div className="text-center">
                              <FileIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <p className="font-medium mt-2">{file.name}</p>
                              <p className="text-sm text-muted-foreground">{formatBytes(file.size)} &middot; {getFileFormatLabel(file.name)}</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                              <p className="mt-2 font-medium">{uploadContent.fileSelection.dragDrop.prompt}</p>
                              <p className="text-sm text-muted-foreground">{uploadContent.fileSelection.dragDrop.csvFormats}</p>
                            </div>
                          )}
                        </div>

                        {form.formState.errors.file && (
                          <p className="text-sm font-medium text-destructive">{form.formState.errors.file.message as string}</p>
                        )}

                        {file && <MappingStatusAlerts mapping={mapping} onOpenModal={() => setShowMappingModal(true)} />}

                        {file && showPreview && (
                          <DataPreview data={parsedData!} schema={schema} columnOrder={mapping.columnOrder} />
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2">
                            {file && (
                              <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile}>
                                <X className="h-4 w-4 mr-2" />{commonContent.buttons.removeFile}
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {currentStep < UPLOAD_STEPS.length - 1 && (
                              <Button type="button" variant="outline" size="sm" onClick={() => handleStepChange(currentStep + 1)}>
                                {commonContent.buttons.skipForNow}<ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            )}
                            <Button type="submit" disabled={!canUpload}>
                              {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{commonContent.loading.uploading}</>) : (<><UploadCloud className="mr-2 h-4 w-4" />{uploadContent.fileSelection.uploadFileButton}</>)}
                            </Button>
                          </div>
                        </div>
                      </form>
                    </TabsContent>

                    {/* --- Paste data tab --- */}
                    <TabsContent value="paste">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="paste-area">{uploadContent.fileSelection.paste.label}</Label>
                          <p className="text-xs text-muted-foreground">{uploadContent.fileSelection.paste.instruction}</p>
                          <Textarea
                            id="paste-area"
                            placeholder={uploadContent.fileSelection.paste.placeholder}
                            value={pasteContent}
                            onChange={(e) => {
                              setPasteContent(e.target.value);
                              if (parsedData) { setParsedData(null); setMapping(INITIAL_MAPPING_STATE); }
                            }}
                            rows={8}
                            className="font-mono text-xs"
                          />
                        </div>

                        {pasteContent.trim() && !parsedData && (
                          <Button type="button" variant="secondary" onClick={handlePasteAnalyze}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />{uploadContent.fileSelection.paste.analyzeButton}
                          </Button>
                        )}

                        {parsedData && parsedData.sourceFormat === "paste" && (
                          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700 dark:text-blue-400">
                              {uploadContent.fileSelection.paste.detectedData(parsedData.headers.length, parsedData.rows.length)}
                            </AlertDescription>
                          </Alert>
                        )}

                        {parsedData && <MappingStatusAlerts mapping={mapping} onOpenModal={() => setShowMappingModal(true)} />}

                        {showPreview && (
                          <DataPreview data={parsedData!} schema={schema} columnOrder={mapping.columnOrder} />
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2">
                            {parsedData && (
                              <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile}>
                                <X className="h-4 w-4 mr-2" />{commonContent.buttons.clear}
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {currentStep < UPLOAD_STEPS.length - 1 && (
                              <Button type="button" variant="outline" size="sm" onClick={() => handleStepChange(currentStep + 1)}>
                                {commonContent.buttons.skipForNow}<ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            )}
                            <Button type="button" disabled={!canUpload} onClick={() => handleUpload()}>
                              {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{commonContent.loading.uploading}</>) : (<><UploadCloud className="mr-2 h-4 w-4" />{uploadContent.fileSelection.uploadDataButton}</>)}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  /* ============ District maps — file upload only ============ */
                  <form onSubmit={form.handleSubmit(handleUpload)} onDragEnter={handleDrag} className="space-y-4">
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                        dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                        form.formState.errors.file && "border-destructive",
                        file && "border-primary/50",
                      )}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => inputRef.current?.click()}
                    >
                      <Input {...form.register("file")} ref={inputRef} type="file" accept={step.accept} className="hidden" />
                      {file ? (
                        <div className="text-center">
                          <FileIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="font-medium mt-2">{file.name}</p>
                          <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 font-medium">{uploadContent.fileSelection.dragDrop.prompt}</p>
                          <p className="text-sm text-muted-foreground">{uploadContent.fileSelection.dragDrop.districtMapsFormats}</p>
                        </div>
                      )}
                    </div>
                    {form.formState.errors.file && <p className="text-sm font-medium text-destructive">{form.formState.errors.file.message as string}</p>}
                    {file && (
                      <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <AlertDescription className="text-emerald-700 dark:text-emerald-400">{uploadContent.fileSelection.fileReadyToUpload}</AlertDescription>
                      </Alert>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        {file && <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile}><X className="h-4 w-4 mr-2" />{commonContent.buttons.removeFile}</Button>}
                      </div>
                      <div className="flex items-center gap-2">
                        {currentStep < UPLOAD_STEPS.length - 1 && (
                          <Button type="button" variant="outline" size="sm" onClick={() => handleStepChange(currentStep + 1)}>
                            {commonContent.buttons.skipForNow}<ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        )}
                        <Button type="submit" disabled={!canUpload}>
                          {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{commonContent.loading.uploading}</>) : (<><UploadCloud className="mr-2 h-4 w-4" />{uploadContent.fileSelection.uploadFileButton}</>)}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Upload history */}
            {logs.length > 0 && (
              <Card className="mt-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ScrollText className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">{uploadContent.wizard.uploadHistory}</h4>
                  </div>
                  <Separator className="mb-3" />
                  <ScrollArea className="max-h-[240px]">
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className={cn(
                            "flex items-start gap-3 p-2.5 rounded-md border text-sm",
                            log.success ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20",
                          )}
                        >
                          {log.success ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium truncate text-xs">{log.fileName}</p>
                              <time className="text-xs text-muted-foreground flex-shrink-0">{new Date(log.timestamp).toLocaleString()}</time>
                            </div>
                            <p className={cn("text-xs mt-0.5", log.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>{log.message}</p>
                            {log.uploadedBy && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><User className="h-3 w-3" />{log.uploadedBy}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

      {/* Field mapping modal */}
      {mapping.result && schema && (
        <FieldMappingModal open={showMappingModal} onOpenChange={setShowMappingModal} matchResult={mapping.result} schema={schema} onConfirm={handleMappingConfirm} />
      )}
    </div>
  );
}
