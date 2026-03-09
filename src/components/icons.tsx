/**
 * Custom SVG icon components for the VoteVault brand.
 */

import type { SVGProps } from "react";

export const VoteVaultIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M7 10l5 5 5-5" />
    <path d="M2 10h20v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10z" />
  </svg>
);
