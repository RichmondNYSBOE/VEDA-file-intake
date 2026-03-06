"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface ElectionAuthority {
  name: string;
  type: string;
}

const AUTHORITIES: ElectionAuthority[] = [
  { name: "Rensselaer County Board of Elections", type: "County Board of Elections" },
  { name: "Tamarac CSD", type: "Central School District" },
  { name: "Brunswick Town Library", type: "Public Library" },
];

/** Sentinel value representing "all authorities combined". */
export const ALL_AUTHORITIES: ElectionAuthority = { name: "__all__", type: "All" };

interface ElectionAuthorityContextValue {
  authorities: ElectionAuthority[];
  selected: ElectionAuthority;
  setSelected: (authority: ElectionAuthority) => void;
  /** Whether the user has selected the combined "All Authorities" view. */
  isAllSelected: boolean;
}

const ElectionAuthorityContext = createContext<ElectionAuthorityContextValue | null>(null);

export function ElectionAuthorityProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ElectionAuthority>(AUTHORITIES[0]);

  const isAllSelected = selected.name === ALL_AUTHORITIES.name;

  return (
    <ElectionAuthorityContext.Provider value={{ authorities: AUTHORITIES, selected, setSelected, isAllSelected }}>
      {children}
    </ElectionAuthorityContext.Provider>
  );
}

export function useElectionAuthority(): ElectionAuthorityContextValue {
  const ctx = useContext(ElectionAuthorityContext);
  if (!ctx) {
    throw new Error("useElectionAuthority must be used within an ElectionAuthorityProvider");
  }
  return ctx;
}
