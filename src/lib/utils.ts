/**
 * @file Shared utility helpers used across the application.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges class names using clsx (conditional classes) and tailwind-merge
 * (deduplicates conflicting Tailwind utilities).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
