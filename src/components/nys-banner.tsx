"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function NYSBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-nys-banner text-white">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4 text-nys-gold"
          >
            <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
          </svg>
          <span>An official website of New York State</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-2 underline text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
            aria-expanded={expanded}
          >
            Here&apos;s how you know
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="container mx-auto px-4 pb-4 text-sm text-gray-300 border-t border-gray-600 pt-3">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-nys-gold flex-shrink-0 mt-0.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
              <div>
                <p className="font-semibold text-white">Official websites use .gov</p>
                <p>A .gov website belongs to an official government organization in the United States.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-nys-gold flex-shrink-0 mt-0.5">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
              <div>
                <p className="font-semibold text-white">Secure .gov websites use HTTPS</p>
                <p>A lock icon or https:// means you&apos;ve safely connected to the .gov website.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
