"use client";

/**
 * Main Dashboard component. Orchestrates the primary user interface: displays
 * election events with compliance badges, no-elections certifications, and
 * provides navigation to the upload wizard and history views. Supports both
 * single-authority and combined 'all authorities' views. Contains helper
 * components: ComplianceBadge, FileStatusDots, ElectionEventCard, CertificationCard.
 */

import { useState, useEffect, useCallback } from "react";
import {
  getElectionEvents,
  getNoElectionsCertifications,
  type ElectionEvent,
  type NoElectionsCertification,
} from "@/app/actions";
import { useElectionAuthority, ALL_AUTHORITIES } from "@/components/election-authority-context";
import { CreateElectionDialog } from "@/components/create-election-dialog";
import { DeleteElectionDialog } from "@/components/delete-election-dialog";
import { NoElectionsDialog } from "@/components/no-elections-dialog";
import { UploadWizard } from "@/components/upload-wizard";
import { UploadHistory } from "@/components/upload-history";
import { InfoSidebar } from "@/components/info-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UPLOAD_STEPS } from "@/lib/election-types";
import { type ComplianceStatus, getComplianceStatus } from "@/domain/election/compliance";
import {
  Plus,
  ShieldCheck,
  CalendarDays,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  ChevronRight,
  LayoutDashboard,
  History,
  Building2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardContent } from "@/content/dashboard";
import { commonContent } from "@/content/common";

// ---------------------------------------------------------------------------
// Compliance helpers
// ---------------------------------------------------------------------------

function ComplianceBadge({ status }: { status: ComplianceStatus }) {
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

// ---------------------------------------------------------------------------
// File status dots
// ---------------------------------------------------------------------------

function FileStatusDots({ event }: { event: ElectionEvent }) {
  return (
    <div className="flex items-center gap-1.5">
      {UPLOAD_STEPS.map((step) => {
        const isUploaded = event.files[step.fileType]?.uploaded;
        return (
          <div
            key={step.fileType}
            title={`${step.label}: ${isUploaded ? commonContent.status.uploaded : commonContent.status.pending}`}
            className={cn(
              "w-2.5 h-2.5 rounded-full",
              isUploaded
                ? "bg-emerald-500"
                : "bg-gray-300 dark:bg-gray-600",
            )}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Election event card
// ---------------------------------------------------------------------------

function ElectionEventCard({
  event,
  onUploadFiles,
  onDelete,
  showAuthority,
}: {
  event: ElectionEvent;
  onUploadFiles: () => void;
  onDelete: () => void;
  showAuthority?: boolean;
}) {
  const status = getComplianceStatus(event);
  const uploadedCount = UPLOAD_STEPS.filter(
    (s) => event.files[s.fileType]?.uploaded,
  ).length;
  const totalCount = UPLOAD_STEPS.length;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
              <h3 className="font-semibold text-base truncate">
                {event.electionName}
              </h3>
            </div>
            <div className="ml-7 space-y-2">
              {showAuthority && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {event.electionAuthorityName}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{commonContent.labels.date} {event.date}</span>
                <span>{commonContent.labels.type} {event.electionType}</span>
              </div>

              {/* File status */}
              <div className="flex items-center gap-3">
                <FileStatusDots event={event} />
                <span className={cn(
                  "text-xs font-medium",
                  uploadedCount === totalCount
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400",
                )}>
                  {dashboardContent.electionCard.filesUploaded(uploadedCount, totalCount)}
                </span>
              </div>

              {/* Missing files list */}
              {status !== "complete" && (
                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {dashboardContent.electionCard.stillNeeded}{" "}
                  <span className="font-normal">
                    {UPLOAD_STEPS.filter(
                      (s) => !event.files[s.fileType]?.uploaded,
                    )
                      .map((s) => s.label)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              <ComplianceBadge status={status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {dashboardContent.buttons.deleteEvent}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              size="sm"
              variant={status === "complete" ? "outline" : "default"}
              onClick={onUploadFiles}
              className="gap-1.5"
            >
              {status === "complete" ? (
                <>{dashboardContent.buttons.viewFiles}</>
              ) : (
                <>
                  <FileUp className="h-3.5 w-3.5" />
                  {dashboardContent.buttons.uploadFiles}
                </>
              )}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// No Elections certification card
// ---------------------------------------------------------------------------

function CertificationCard({ cert, showAuthority }: { cert: NoElectionsCertification; showAuthority?: boolean }) {
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

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function Dashboard() {
  const { selected: authority, authorities, isAllSelected, setSelected } = useElectionAuthority();
  const [events, setEvents] = useState<ElectionEvent[]>([]);
  const [certifications, setCertifications] = useState<NoElectionsCertification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showNoElectionsDialog, setShowNoElectionsDialog] = useState(false);
  const [wizardEvent, setWizardEvent] = useState<ElectionEvent | null>(null);
  const [wizardAuthority, setWizardAuthority] = useState<{ name: string; type: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [deleteEvent, setDeleteEvent] = useState<ElectionEvent | null>(null);

  const refreshData = useCallback(async () => {
    setIsLoading(true);

    if (isAllSelected) {
      // Fetch from all authorities in parallel
      const results = await Promise.all(
        authorities.map(async (auth) => {
          const [evts, certs] = await Promise.all([
            getElectionEvents(auth.name),
            getNoElectionsCertifications(auth.name),
          ]);
          return { events: evts, certifications: certs };
        }),
      );
      setEvents(results.flatMap((r) => r.events));
      setCertifications(results.flatMap((r) => r.certifications));
    } else {
      if (!authority.name) { setIsLoading(false); return; }
      const [eventsData, certsData] = await Promise.all([
        getElectionEvents(authority.name),
        getNoElectionsCertifications(authority.name),
      ]);
      setEvents(eventsData);
      setCertifications(certsData);
    }
    setIsLoading(false);
  }, [authority.name, isAllSelected, authorities]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle returning from wizard
  const handleWizardBack = useCallback(() => {
    setWizardEvent(null);
    setWizardAuthority(null);
    refreshData();
  }, [refreshData]);

  // Open wizard for a specific event (used in combined view)
  const openWizardForEvent = (event: ElectionEvent) => {
    if (isAllSelected) {
      // In combined view, switch to the specific authority first
      const auth = authorities.find((a) => a.name === event.electionAuthorityName);
      if (auth) {
        setWizardAuthority(auth);
      } else {
        setWizardAuthority({ name: event.electionAuthorityName, type: event.electionAuthorityType });
      }
    }
    setWizardEvent(event);
  };

  // If history is active, render it
  if (showHistory) {
    return (
      <UploadHistory
        onBack={() => {
          setShowHistory(false);
          refreshData();
        }}
      />
    );
  }

  // If wizard is active, render it
  if (wizardEvent) {
    const wizardAuth = wizardAuthority ?? authority;
    return (
      <UploadWizard
        electionEvent={wizardEvent}
        electionAuthorityName={wizardAuth.name}
        electionAuthorityType={wizardAuth.type}
        onBack={handleWizardBack}
      />
    );
  }

  const hasContent = events.length > 0 || certifications.length > 0;

  // In combined view, group events by authority
  const groupedByAuthority = isAllSelected
    ? authorities.map((auth) => ({
        authority: auth,
        events: events.filter((e) => e.electionAuthorityName === auth.name),
        certifications: certifications.filter((c) => c.electionAuthorityName === auth.name),
      })).filter((g) => g.events.length > 0 || g.certifications.length > 0)
    : null;

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Dashboard header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LayoutDashboard className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">
                  {dashboardContent.title}
                </h2>
              </div>
              <p className="text-muted-foreground">
                {isAllSelected ? (
                  <>{dashboardContent.description.allAuthorities}</>
                ) : (
                  <>{dashboardContent.description.singleAuthority(authority.name)}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(true)}
                className="gap-1.5"
              >
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">View</span> History
              </Button>
              {!isAllSelected && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNoElectionsDialog(true)}
                    className="gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span className="hidden sm:inline">Certify</span> No Elections
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowCreateDialog(true)}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    New Election Event
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your data...</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !hasContent && !isAllSelected && (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  No Election Events Yet
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  To begin uploading your election data files, you first need to
                  create an election event. Click the button below to get
                  started.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Election Event
                  </Button>
                  <span className="text-sm text-muted-foreground">or</span>
                  <Button
                    variant="outline"
                    onClick={() => setShowNoElectionsDialog(true)}
                    className="gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Certify No Elections
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state for combined view */}
          {!isLoading && !hasContent && isAllSelected && (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  No Election Events Found
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  None of your election authorities have created election events yet.
                  Select a specific authority from the dropdown to create one.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ============ Combined view — grouped by authority ============ */}
          {!isLoading && isAllSelected && groupedByAuthority && groupedByAuthority.length > 0 && (
            <div className="space-y-8">
              {groupedByAuthority.map((group) => {
                const totalEvents = group.events.length;
                const completeEvents = group.events.filter((e) => getComplianceStatus(e) === "complete").length;

                return (
                  <div key={group.authority.name}>
                    {/* Authority header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <h3 className="text-base font-semibold">{group.authority.name}</h3>
                        <Badge variant="outline" className="text-xs">{group.authority.type}</Badge>
                      </div>
                      {totalEvents > 0 && (
                        <span className={cn(
                          "text-xs font-medium",
                          completeEvents === totalEvents ? "text-emerald-600" : "text-amber-600",
                        )}>
                          {completeEvents}/{totalEvents} complete
                        </span>
                      )}
                    </div>

                    {/* Events for this authority */}
                    <div className="space-y-3 ml-0">
                      {group.events.map((event) => (
                        <ElectionEventCard
                          key={event.id}
                          event={event}
                          onUploadFiles={() => openWizardForEvent(event)}
                          onDelete={() => setDeleteEvent(event)}
                        />
                      ))}
                      {group.certifications.map((cert) => (
                        <CertificationCard key={cert.id} cert={cert} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============ Single authority view ============ */}
          {!isLoading && !isAllSelected && events.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Election Events
              </h3>
              {events.map((event) => (
                <ElectionEventCard
                  key={event.id}
                  event={event}
                  onUploadFiles={() => setWizardEvent(event)}
                  onDelete={() => setDeleteEvent(event)}
                />
              ))}
            </div>
          )}

          {/* Certifications — single authority */}
          {!isLoading && !isAllSelected && certifications.length > 0 && (
            <div className="space-y-3">
              {events.length > 0 && <Separator className="my-6" />}
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                No-Elections Certifications
              </h3>
              {certifications.map((cert) => (
                <CertificationCard key={cert.id} cert={cert} />
              ))}
            </div>
          )}

          {/* Legend */}
          {!isLoading && events.length > 0 && (
            <>
              <Separator className="my-6" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-2">File Status Legend</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {UPLOAD_STEPS.map((step, i) => (
                    <span key={step.fileType} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" />
                      {i + 1}. {step.label}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <InfoSidebar />
        </div>
      </div>

      {/* Dialogs — only in single authority mode */}
      {!isAllSelected && (
        <>
          <CreateElectionDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            electionAuthorityName={authority.name}
            electionAuthorityType={authority.type}
            onCreated={refreshData}
          />

          <NoElectionsDialog
            open={showNoElectionsDialog}
            onOpenChange={setShowNoElectionsDialog}
            electionAuthorityName={authority.name}
            electionAuthorityType={authority.type}
            onCertified={refreshData}
          />
        </>
      )}

      {/* Delete dialog — available in both views */}
      <DeleteElectionDialog
        event={deleteEvent}
        open={deleteEvent !== null}
        onOpenChange={(open) => { if (!open) setDeleteEvent(null); }}
        onDeleted={refreshData}
      />
    </>
  );
}
