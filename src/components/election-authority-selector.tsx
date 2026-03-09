"use client";

/**
 * Dropdown selector for switching between election authorities. Renders in the
 * navigation bar. Includes an 'All Authorities (Combined)' option when multiple
 * authorities are available.
 */

import { Building2, LayoutGrid } from "lucide-react";
import { useElectionAuthority, ALL_AUTHORITIES } from "@/components/election-authority-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export function ElectionAuthoritySelector() {
  const { authorities, selected, setSelected } = useElectionAuthority();

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-accent-foreground/70 flex-shrink-0" />
      <label className="text-sm font-medium text-accent-foreground/70 whitespace-nowrap">
        Election Authority:
      </label>
      <Select
        value={selected.name}
        onValueChange={(name) => {
          if (name === ALL_AUTHORITIES.name) {
            setSelected(ALL_AUTHORITIES);
          } else {
            const authority = authorities.find((a) => a.name === name);
            if (authority) setSelected(authority);
          }
        }}
      >
        <SelectTrigger className="h-8 w-[280px] bg-accent-foreground/10 border-accent-foreground/20 text-accent-foreground text-sm">
          <SelectValue>
            {selected.name === ALL_AUTHORITIES.name ? "All Authorities (Combined)" : selected.name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {authorities.length > 1 && (
            <>
              <SelectItem value={ALL_AUTHORITIES.name}>
                <span className="flex items-center gap-2">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  All Authorities (Combined)
                </span>
              </SelectItem>
              <Separator className="my-1" />
            </>
          )}
          {authorities.map((authority) => (
            <SelectItem key={authority.name} value={authority.name}>
              {authority.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
