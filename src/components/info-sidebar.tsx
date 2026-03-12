"use client";

/**
 * Informational sidebar displayed alongside the dashboard. Shows the current
 * user profile, FAQ links, data dictionary reference, miscellaneous files
 * section, and contact information for the NYS Board of Elections.
 */

import { User, HelpCircle, BookOpen, FileText, FolderOpen, Phone, Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useElectionAuthority } from "@/components/election-authority-context";
import { dashboardContent } from "@/content/dashboard";

export function InfoSidebar() {
  const { selected } = useElectionAuthority();
  const sidebar = dashboardContent.infoSidebar;

  return (
    <aside className="flex flex-col gap-5">
      {/* User Profile */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{sidebar.userProfile.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">{sidebar.userProfile.nameLabel}</p>
            <p className="font-medium">{sidebar.userProfile.nameValue}</p>
          </div>
          <Separator />
          <div>
            <p className="text-muted-foreground">{sidebar.userProfile.authorityTypeLabel}</p>
            <p className="font-medium">{selected.type}</p>
          </div>
          <Separator />
          <div>
            <p className="text-muted-foreground">{sidebar.userProfile.authorityNameLabel}</p>
            <p className="font-medium">{selected.name}</p>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{sidebar.faq.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="space-y-2">
            {sidebar.faq.items.map((item) => (
              <li key={item} className="hover:text-primary cursor-pointer transition-colors">
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* User Guide */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{sidebar.userGuide.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{sidebar.userGuide.description}</p>
        </CardContent>
      </Card>

      {/* Data Dictionary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{sidebar.dataDictionary.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{sidebar.dataDictionary.description}</p>
        </CardContent>
      </Card>

      {/* Miscellaneous Files */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{sidebar.miscellaneousFiles.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{sidebar.miscellaneousFiles.description}</p>
        </CardContent>
      </Card>

      {/* Contact Us */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{sidebar.contactUs.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span>{sidebar.contactUs.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <a
              href={`mailto:${sidebar.contactUs.email}`}
              className="hover:text-primary transition-colors underline"
            >
              {sidebar.contactUs.email}
            </a>
          </div>
          <p className="text-muted-foreground text-xs pt-1">
            {sidebar.contactUs.organization}
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}
