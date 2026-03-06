"use client";

import { User, HelpCircle, BookOpen, FolderOpen, Phone, Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useElectionAuthority } from "@/components/election-authority-context";

export function InfoSidebar() {
  const { selected } = useElectionAuthority();

  return (
    <aside className="flex flex-col gap-5">
      {/* User Profile */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">User Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="font-medium">Ryan Richmond</p>
          </div>
          <Separator />
          <div>
            <p className="text-muted-foreground">Election Authority Type</p>
            <p className="font-medium">{selected.type}</p>
          </div>
          <Separator />
          <div>
            <p className="text-muted-foreground">Election Authority Name</p>
            <p className="font-medium">{selected.name}</p>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">FAQ</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="space-y-2">
            <li className="hover:text-primary cursor-pointer transition-colors">
              How do I upload a file?
            </li>
            <li className="hover:text-primary cursor-pointer transition-colors">
              What file formats are accepted?
            </li>
            <li className="hover:text-primary cursor-pointer transition-colors">
              What is the maximum file size?
            </li>
            <li className="hover:text-primary cursor-pointer transition-colors">
              How do I correct a submission?
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Data Dictionary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Data Dictionary</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Reference documentation for column definitions, data types, and
            validation rules for each file type.
          </p>
        </CardContent>
      </Card>

      {/* Miscellaneous Files */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Miscellaneous Files</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Supplemental documents, templates, and reference materials.
          </p>
        </CardContent>
      </Card>

      {/* Contact Us */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Contact Us</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span>(518) 474-6220</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <a
              href="mailto:info@elections.ny.gov"
              className="hover:text-primary transition-colors underline"
            >
              info@elections.ny.gov
            </a>
          </div>
          <p className="text-muted-foreground text-xs pt-1">
            New York State Board of Elections
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}
